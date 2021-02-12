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

app = Flask(__name__)
d3_dendro = None
segments = []
clusters = []

clustering_method = None
selection_method = None
conditional_questioning = None
prioritize_separation2clustering = None

current_diar = None
initial_diar = None
current_vec = None
scores_per_cluster = None
uem = None
ref = None

links_to_check = None
link = None
number_cluster = None
complete_list = None
temporary_link_list = None
der_track = None

no_more_clustering = False
no_more_separation = False

separated_list = []
stop_separation_list = []  # a list of nodes that have gotten confirmation for separation question
stop_clustering_list = []  # a list of nodes that have gotten confirmation for clustering question

node_waiting_for_answer_is_grouped = False


class Flash_Thread(threading.Thread):
    def __init__(self, app):
        threading.Thread.__init__(self)
        self.app = app

    def run(self):
        self.app.run(port=5000)


@app.route('/load_file', methods=['POST'])
def load_file():
    global current_diar, initial_diar, current_vec, scores_per_cluster, uem, ref
    global clustering_method, selection_method, conditional_questioning, prioritize_separation2clustering
    global links_to_check, init_diar, link, number_cluster, complete_list, temporary_link_list, der_log, der_track
    global no_more_clustering, no_more_separation, separated_list, stop_separation_list, stop_clustering_list

    show_name = request.form.get('showName')
    current_diar, initial_diar, current_vec, scores_per_cluster, uem, ref = s4d_ui_load(show_name)

    # Load settings
    clustering_method = request.form.get('clustering_method')
    selection_method = request.form.get('selection_method')
    conditional_questioning = json.loads(request.form.get('conditional_questioning'))
    prioritize_separation2clustering = json.loads(request.form.get('prioritize_separation2clustering'))

    # Parameter fixed in the code
    threshold = 30

    init_diar = copy.deepcopy(initial_diar)
    # Get the linkage matrix from the scores
    distances, th = scores2distance(scores_per_cluster, threshold)
    distance_sym = squareform(distances)

    # Perform the clustering
    number_cluster = len(scores_per_cluster.scoremat)
    complete_list = list(scores_per_cluster.modelset)
    link = hac.linkage(distance_sym, method=clustering_method)

    # Sort the nodes according to their DELTA to the threshold
    tmp = np.zeros((link.shape[0], link.shape[1] + 2))
    tmp[:, :-2] = link
    tmp[:, -2] = link[:, 2] - th
    tmp[:, -1] = np.abs(link[:, 2] - th)
    links_to_check = tmp[np.argsort(tmp[:, -1])]

    # prepare dendrogram for UI
    tree = scipy.cluster.hierarchy.to_tree(link, rd=False)
    json_tree = add_node(tree, None, number_cluster, link)

    # Initialize the list of link to create

    # This corresponds to the links that must be done if not using any human assistance
    temporary_link_list = []
    for l in link:
        if l[2] < th:
            temporary_link_list.append(l)  # final_links
            # -----------> temporary_link_list contient la liste des noeuds qui sont fait (trait plein sur le dendrogramme)
            #   les noeuds qui ne sont pas dans cette liste doivent être en pointillés sur le dendrogramme

    # create der_track dictionary and calculate intial DER
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
    stop_separation_list = []  # a list of nodes that have gotten confirmation for separation question
    stop_clustering_list = []  # a list of nodes that have gotten confirmation for clustering question

    data_for_ui = json.dumps(dict(tree=json_tree, threshold=th, clusters=complete_list, segments=current_diar.segments, der_track=der_track))

    return data_for_ui


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


@app.route('/answer_question', methods=['POST'])
def answer_question():
    global links_to_check,  no_more_separation, no_more_clustering, der_track
    global stop_separation_list, separated_list, stop_clustering_list
    node = links_to_check[0]
    is_same_speaker = json.loads(request.form.get('is_same_speaker'))

    if node_waiting_for_answer_is_grouped:
        if is_same_speaker:
            stop_separation_list += get_node_spkeakers(node[0], number_cluster, link)
            stop_separation_list += get_node_spkeakers(node[1], number_cluster, link)
            if set(complete_list).issubset(set(stop_separation_list)):
                # All down branches have gotten a confirmation answer
                no_more_separation = True
            link_tmp = copy.deepcopy(temporary_link_list)
            diar_tmp = copy.deepcopy(init_diar)
            der_track, new_diar, new_vec = track_correction_process(diar_tmp,
                                                                    current_vec,
                                                                    scores_per_cluster,
                                                                    link_tmp,
                                                                    der_track,
                                                                    "not_separation",
                                                                    uem,
                                                                    ref)
            # if the human decide to separate the node
        else:
            # update list to avoid a conflict with clustering
            separated_list += get_node_spkeakers(node[0], number_cluster, link)
            separated_list += get_node_spkeakers(node[1], number_cluster, link)
            for ii, fl in enumerate(temporary_link_list):
                if np.array_equal(fl, node[:4]):
                    _ = temporary_link_list.pop(ii)
            # Record the correction and the DER
            link_tmp = copy.deepcopy(temporary_link_list)
            diar_tmp = copy.deepcopy(init_diar)
            der_track, new_diar, new_vec = track_correction_process(diar_tmp,
                                                                    current_vec,
                                                                    scores_per_cluster,
                                                                    link_tmp,
                                                                    der_track,
                                                                    "separation",
                                                                    uem,
                                                                    ref)
    else:
        # if the human validate the node (it has not been grouped and it must be)
        if is_same_speaker:
            temporary_link_list.append(node[:4])
            # Record the correction and the DER
            link_tmp = copy.deepcopy(temporary_link_list)
            diar_tmp = copy.deepcopy(init_diar)
            der_track, new_diar, new_vec = track_correction_process(diar_tmp,
                                                                    current_vec,
                                                                    scores_per_cluster,
                                                                    link_tmp,
                                                                    der_track,
                                                                    "clustering",
                                                                    uem,
                                                                    ref)

        # Else stop exploring the tree upward
        else:
            # update list to avoid a conflict with clustering
            stop_clustering_list += get_node_spkeakers(node[0], number_cluster, link)
            stop_clustering_list += get_node_spkeakers(node[1], number_cluster, link)
            if set(complete_list).issubset(set(stop_clustering_list)):
                no_more_clustering = True
            link_tmp = copy.deepcopy(temporary_link_list)
            diar_tmp = copy.deepcopy(init_diar)
            der_track, new_diar, new_vec = track_correction_process(diar_tmp,
                                                                    current_vec,
                                                                    scores_per_cluster,
                                                                    link_tmp,
                                                                    der_track,
                                                                    "not_clustering",
                                                                    uem,
                                                                    ref)
    links_to_check = np.delete(links_to_check, 0, axis=0)
    return json.dumps(der_track)


@app.route('/next_question', methods=['POST'])
def next_question():
    global no_more_clustering, no_more_separation, links_to_check

    length = len(links_to_check)
    while length > 0:
        node = links_to_check[0]

        # In case we stop exploring the tree
        if no_more_clustering and no_more_separation:
            break

        # Check node below the threshold
        if node[-2] < 0:

            # If conditional_questioning is active, We estimate the quality of the question for this node
            if conditional_questioning:
                # If True we don't ask about this node
                not_suitable_question = check_std_change(node,
                                                         scores_per_cluster,
                                                         init_diar,
                                                         current_vec,
                                                         link,
                                                         "separation")
                # if the node has been labeled as sure enough, we don't ask question to the human
                if not_suitable_question:
                    pass

            # check if the node is part of a branch that has gotten a confirmation answer before
            branch1_nodes = get_node_spkeakers(node[0], number_cluster, link)
            branch2_nodes = get_node_spkeakers(node[1], number_cluster, link)
            if set(branch1_nodes + branch2_nodes).issubset(set(stop_separation_list)):
                no_more_separation = True
                pass

            # If we already decided not tyo explore down the tree
            if no_more_separation:
                pass
            # otherwise as question to the human about this node
            else:
                # Ask the human
                # on récupère la liste ordonnée des segments appartenant aux deux branches de ce noeud
                first_seg_list_sorted, second_seg_list_sorted = get_segment_sorted_list(node,
                                                                                        link,
                                                                                        scores_per_cluster,
                                                                                        None,
                                                                                        init_diar,
                                                                                        current_vec,
                                                                                        selection_method)

                # On présente les deux listes de segments ordonnées à l'utilisateur pour qu'il puisse écouter ceux qu'il veut
                # L'utilisateur selectionne un segment dans chacune des deux listes (first_seg_list_sorted, second_seg_list_sorted )
                # et peux alors écouter les segments correspondant.
                # Il peut ensuite décider si les deux clusters appartiennent à la même personne ou pas
                # cette réponse est récupérée dans un booleen : is_same_speaker

                question = dict(segs1=first_seg_list_sorted, segs2=second_seg_list_sorted, node=node.tolist())
                return json.dumps(question)

        # Check node above the threshold
        elif node[-2] > 0:
            # If conditional_questioning is active, We estimate the quality of the question for this node
            if conditional_questioning:
                # If True we don't ask about this node
                not_suitable_question = check_std_change(node,
                                                         scores_per_cluster,
                                                         init_diar,
                                                         current_vec,
                                                         link,
                                                         "clustering")
                # if the node has been labeled as sure enough, we don't ask question to the human
                if not_suitable_question:
                    pass

            if prioritize_separation2clustering:
                # In order to avoid any conflict for clustering and separation
                # and based on the fact that separation gives more gain
                # check if the node is part of a branch that has been clustered before
                branch1_nodes = get_node_spkeakers(node[0], number_cluster, link)
                branch2_nodes = get_node_spkeakers(node[1], number_cluster, link)
                if not set(branch1_nodes + branch2_nodes).isdisjoint(set(separated_list)):
                    print("In order to avoid conflict and by prioritizing separation, clustering stopped!")
                    pass
            # check if the node is part of a branch that has gotten a confirmation answer before
            branch1_nodes = get_node_spkeakers(node[0], number_cluster, link)
            branch2_nodes = get_node_spkeakers(node[1], number_cluster, link)
            if set(branch1_nodes + branch2_nodes).issubset(set(stop_clustering_list)):
                    no_more_clustering = True
                    pass

            # If we already decided not to explore up the tree
            if no_more_clustering:
                pass
            # otherwise as question to the human about this node
            else:
                # Ask the human
                # on récupère la liste ordonnée des segments appartenant aux deux branches de ce noeud
                first_seg_list_sorted, second_seg_list_sorted = get_segment_sorted_list(node,
                                                                                        link,
                                                                                        scores_per_cluster,
                                                                                        None,
                                                                                        init_diar,
                                                                                        current_vec,
                                                                                        selection_method)

                # On présente les deux listes de segments ordonnées à l'utilisateur pour qu'il puisse écouter ceux qu'il veut
                # L'utilisateur selectionne un segment dans chacune des deux listes (first_seg_list_sorted, second_seg_list_sorted )
                # et peux alors écouter les segments correspondant.
                # Il peut ensuite décider si les deux clusters appartiennent à la même personne ou pas
                # cette réponse est récupérée dans un booleen : is_same_speaker

                #question = dict(node=node)

                question = dict(segs1=first_seg_list_sorted, segs2=second_seg_list_sorted, node=node.tolist())
                return json.dumps(question)

        links_to_check = np.delete(links_to_check, 0, axis=0)
        length = len(links_to_check)

    # We have reached the end of the while loop without finding question, so there are no more questions to ask
    res = dict(error="No more question")
    return json.dumps(res)


if __name__ == "__main__":
    # launch the flask server on a thread
    thread = Flash_Thread(app=app)
    thread.start()
