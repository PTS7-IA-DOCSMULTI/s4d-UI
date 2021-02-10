import threading

from flask import Flask, request
import copy
import json
import numpy as np
import scipy
import sidekit
import s4d

from s4d.s4d.clustering.hac_utils import scores2distance
from scipy.cluster import hierarchy as hac
from scipy.spatial.distance import squareform

from evallies.lium_baseline.interactive import check_std_change
from evallies.lium_baseline.interactive import get_segment_sorted_list
from evallies.lium_baseline.interactive import get_node_spkeakers
from evallies.lium_baseline.interactive import track_correction_process

from evallies.der_single import *
import evallies
from s4d.s4d.diar import Diar
from s4d.s4d.scoring import DER


class Flash_Thread(threading.Thread):
    def __init__(self, app):
        threading.Thread.__init__(self)
        self.app = app

    def run(self):
        self.app.run(port=5000)


def s4d_ui_load(show_name):
    # Load data depending on the selected WAV file
    current_diar = s4d.s4d.Diar.read_mdtm(f"{show_name}.mdtm")
    initial_diar = s4d.s4d.Diar.read_mdtm(f"{show_name}.first.mdtm")
    current_vec = sidekit.StatServer(f"{show_name}_xv.h5")
    scores_per_cluster = sidekit.Scores(f"{show_name}.scores.h5")
    # GET UEM
    st = []
    en = []
    for l in open(f"{show_name}.uem", "r"):
        e = l.split()
        st.append(e[2])
        en.append(e[3])
    # uem = {"start_time": np.cast["float64"](st), "end_time": np.cast["float64"](en)}
    uem = evallies.user_simulation.UEM(np.cast["float64"](st), np.cast["float64"](en))
    # GET Speakers
    spk = []
    ref_st = []
    ref_en = []
    for l in open(f"{show_name}.ref.mdtm", "r"):
        e = l.split()
        ref_st.append(np.cast["float64"](round(float(e[2]), 3)))
        ref_en.append(np.cast["float64"](round(float(e[2]) + float(e[3]), 3)))
        spk.append(e[7])
    speakers = evallies.user_simulation.Reference(spk, ref_st, ref_en)
    return current_diar, initial_diar, current_vec, scores_per_cluster, uem, speakers


# Create a nested dictionary from the ClusterNode's returned by SciPy
def add_node(node, parent, number_cluster, link):
    # First create the new node and append it to its parent's children
    new_node = dict(node_id=node.id, height=0, children=[])
    if parent is None:
        parent = new_node
    else:
        parent["children"].append(new_node)

    new_node["height"] = node.dist

    # Recursively add the current node's children
    if node.left:
        add_node(node.left, new_node, number_cluster, link)
    if node.right:
        add_node(node.right, new_node, number_cluster, link)

    return parent


app = Flask(__name__)
d3_dendro = None
segments = []
clusters = []
der_log = []
th_json = None


@app.route('/', methods=['POST'])
def calculation():
    val = request.form.get('value')
    return str("recu: " + val)


@app.route('/dendrogram', methods=['POST'])
def send_dendrogram():
    return d3_dendro


@app.route('/segments', methods=['POST'])
def send_segments():
    return segments


@app.route('/clusters', methods=['POST'])
def send_clusters():
    return clusters


@app.route('/der_log', methods=['POST'])
def send_der_log():
    return der_log


if __name__ == "__main__":

    # launch the flask server on a thread
    thread = Flash_Thread(app=app)
    thread.start()

    # Parameter fixed in the code
    threshold = 30

    # Following parameters should be modifiable through menus,
    # default values are given and other possible values are given as comment
    clustering_method = "complete"  # other values:    'ward’, ‘complete’, ‘average’, ‘single’
    selection_method = "longest"  # "cluster_center", "max_noBICHAC"
    conditional_questioning = False  # True or False
    prioritize_separation2clustering = "False"  # true or False

    current_diar, initial_diar, current_vec, scores_per_cluster, uem, ref = s4d_ui_load(
        "LCP_LCPInfo13h30_2012-02-16_132700")

    print("segments:")
    print(current_diar.segments)
    segments = json.dumps(current_diar.segments)

    init_diar = copy.deepcopy(initial_diar)
    # Get the linkage matrix from the scores
    distances, th = scores2distance(scores_per_cluster, threshold)
    distance_sym = squareform(distances)

    # Perform the clustering
    number_cluster = len(scores_per_cluster.scoremat)
    complete_list = list(scores_per_cluster.modelset)
    clusters = json.dumps(complete_list)
    link = hac.linkage(distance_sym, method=clustering_method)
    print("Matrice de linkage:")
    print(link)

    # Sort the nodes according to their DELTA to the threshold
    tmp = np.zeros((link.shape[0], link.shape[1] + 2))
    tmp[:, :-2] = link
    tmp[:, -2] = link[:, 2] - th
    tmp[:, -1] = np.abs(link[:, 2] - th)
    links_to_check = tmp[np.argsort(tmp[:, -1])]

    print("Noeud à vérifier:")
    print(links_to_check)

    # prepare dendrogram for UI
    T = scipy.cluster.hierarchy.to_tree(link, rd=False)
    tree = add_node(T, None, number_cluster, link)
    d3_dendro = json.dumps(dict(tree=tree, threshold=th))
    print(d3_dendro)

    # Initialize the list of link to create

    # This corresponds to the links that must be done if not using any human assistance
    temporary_link_list = []
    for l in link:
        if l[2] < th:
            temporary_link_list.append(l)  # final_links
            # -----------> temporary_link_list contient la liste des noeuds qui sont fait (trait plein sur le dendrogramme)
            #   les noeuds qui ne sont pas dans cette liste doivent être en pointillés sur le dendrogramme
    print("temporary_link_list")
    print(temporary_link_list)

    # creat der_track dictionary and calculate intial DER
    der, time, new_diar, new_vec = evallies.lium_baseline.interactive.check_der(current_diar,
                                                                                current_vec,
                                                                                list(scores_per_cluster.modelset),
                                                                                temporary_link_list,
                                                                                uem,
                                                                                ref)
    print("Initial DER : ", der, "(Criteria 2: process_all_nodes = True)")
    der_track = {"time": time, "der_log": [der], "correction": ["initial"]}
    der_log = json.dumps([der])
    # Check all nodes from the tree
    no_more_clustering = False
    no_more_separation = False

    # a list of nodes that have separated to avoid any conflict with clustering
    # it will be used in case of prioritize_separation2clustering
    separated_list = []
    stop_separation_list = []  # a list of nodes that have gotten confirmaton for seperation question
    stop_clustering_list = []  # a list of nodes that have gotten confirmaton for clustering question
