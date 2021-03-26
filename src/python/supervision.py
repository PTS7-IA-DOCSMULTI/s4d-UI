# -* coding: utf-8 -*-
#
# This file is part of S4D-UI.
#
# S4D-UI is an interface for S4D to allow human supervision of the diarization
# S4D-UI home page: https://github.com/PTS7-IA-DOCSMULTI/s4d-UI
# S4D home page: http://www-lium.univ-lemans.fr/s4d/
# SIDEKIT home page: http://www-lium.univ-lemans.fr/sidekit/
#
# S4D-UI is free software: you can redistribute it and/or modify
# it under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# S4D-UI is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with S4D-UI.  If not, see <http://www.gnu.org/licenses/>.
"""
Copyright 2020-2021 Florian Plaut, Nicolas Poupon, Adrien Puertolas, Alexandre Flucha

"""

__license__ = "LGPL"
__author__ = "Florian Plaut, Nicolas Poupon, Adrien Puertolas, Alexandre Flucha"
__copyright__ = "Copyright 2020-2021 Florian Plaut, Nicolas Poupon, Adrien Puertolas, Alexandre Flucha"

import pickle
import threading

from flask import Flask, request
import json
import scipy
import sidekit
import s4d

from s4d.clustering.hac_utils import scores2distance
from scipy.cluster import hierarchy as hac
from scipy.spatial.distance import squareform

from evallies.lium_baseline.interactive import check_std_change
from evallies.lium_baseline.interactive import get_segment_sorted_list
from evallies.lium_baseline.interactive import get_node_spkeakers
from evallies.lium_baseline.interactive import track_correction_process
from evallies.lium_baseline.system import allies_write_diar, extract_vectors, perform_iv_seg

from evallies.der_single import *
import evallies
from s4d.diar import Diar
import os
import yaml

app = Flask(__name__)

# Parameter fixed in the code
threshold = 30

# Settings
clustering_method = None
selection_method = None
conditional_questioning = None
prioritize_separation2clustering = None

current_diar = None
first_pass_diar = None
current_vec = None
current_vec_per_seg = None
first_pass_vec = None
first_pass_vec_per_seg = None
scores_per_cluster = None

init_diar = None

uem = None
ref = []
der_log = []

links_to_check = None
link = None
number_cluster = None
complete_list = None
temporary_link_list = []
der_track = None

no_more_clustering = False
no_more_separation = False

separated_list = []
stop_separation_list = []  # a list of nodes that have gotten confirmation for separation question
stop_clustering_list = []  # a list of nodes that have gotten confirmation for clustering question

node_waiting_for_answer_is_grouped = False

root_folder = None
show_name = None
vectors_type = None


class FlaskThread(threading.Thread):
    def __init__(self, app):
        threading.Thread.__init__(self)
        self.app = app

    def run(self):
        self.app.run(port=5000)


@app.route('/load_data_for_ui', methods=['POST'])
def load_data_for_ui():
    global current_diar, first_pass_diar, current_vec_per_seg, scores_per_cluster, uem, ref
    global clustering_method, selection_method, conditional_questioning, prioritize_separation2clustering
    global links_to_check, init_diar, link, number_cluster, complete_list, temporary_link_list, der_log, der_track
    global no_more_clustering, no_more_separation, separated_list, stop_separation_list, stop_clustering_list

    # GET UEM
    st = []
    en = []
    for l in open(f"{root_folder}/{show_name}.uem", "r"):
        e = l.split()
        st.append(e[2])
        en.append(e[3])
    # uem = {"start_time": np.cast["float64"](st), "end_time": np.cast["float64"](en)}
    uem = evallies.user_simulation.UEM(np.cast["float64"](st), np.cast["float64"](en))
    # GET Speakers
    spk = []
    ref_st = []
    ref_en = []
    for l in open(f"{root_folder}/{show_name}.ref.mdtm", "r"):
        e = l.split()
        ref_st.append(np.cast["float64"](round(float(e[2]), 3)))
        ref_en.append(np.cast["float64"](round(float(e[2]) + float(e[3]), 3)))
        spk.append(e[7])
    ref = evallies.user_simulation.Reference(spk, ref_st, ref_en)

    init_diar = copy.deepcopy(first_pass_diar)
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

    # Initialize the list of link to create

    # This corresponds to the links that must be done if not using any human assistance
    temporary_link_list = []
    for l in link:
        if l[2] < th:
            temporary_link_list.append(l)  # final_links

    # create der_track dictionary and calculate intial DER
    der, time, current_diar, new_vec = evallies.lium_baseline.interactive.check_der(current_diar,
                                                                                    current_vec_per_seg,
                                                                                    list(scores_per_cluster.modelset),
                                                                                    temporary_link_list,
                                                                                    uem,
                                                                                    ref)

    # prepare dendrogram for UI
    tree = scipy.cluster.hierarchy.to_tree(link, rd=False)
    json_tree = add_node(tree, None)

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

    data_for_ui = json.dumps(
        dict(tree=json_tree, threshold=th, clusters=complete_list, segments=first_pass_diar.segments, der_track=der_track))

    return data_for_ui


@app.route('/get_init_diar', methods=['POST'])
def get_init_diar():
    json_str = str(request.get_json())
    json_str = json_str.replace("\'", "\"")
    show_name = json.loads(json_str)['show_name']

    global first_pass_diar
    first_pass_diar = s4d.Diar.read_mdtm(f"{show_name}.first.mdtm")
    return json.dumps(dict(segments=first_pass_diar.segments))


@app.route('/get_user_seg', methods=['POST'])
def get_user_seg():
    json_str = str(request.get_json())
    json_str = json_str.replace("\'", "\"")
    show_name = json.loads(json_str)['show_name']

    global first_pass_diar
    first_pass_diar = s4d.Diar.read_mdtm(f"{show_name}.user_seg.mdtm")
    return json.dumps(dict(segments=first_pass_diar.segments))


# Create a nested dictionary from the ClusterNode's returned by SciPy
def add_node(node, parent):
    # First create the new node and append it to its parent's children
    new_node = dict(node_id=node.id, height=0, children=[])
    if parent is None:
        parent = new_node
    else:
        parent["children"].append(new_node)

    new_node["height"] = node.dist
    new_node["isGrouped"] = node_is_grouped(node)

    # Recursively add the current node's children
    if node.left:
        add_node(node.left, new_node)
    if node.right:
        add_node(node.right, new_node)

    return parent


def node_is_grouped(node):
    if node.left and node.right:
        for l in temporary_link_list:
            if l[0] == int(node.left.id) and l[1] == int(node.right.id):
                return True
    return False


@app.route('/answer_question', methods=['POST'])
def answer_question():
    global links_to_check, no_more_separation, no_more_clustering, der_track, current_diar
    global stop_separation_list, separated_list, stop_clustering_list, temporary_link_list
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
            der_track, current_diar, new_vec = track_correction_process(diar_tmp,
                                                                        current_vec_per_seg,
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
                    break
            temporary_link_list = correct_link_after_removing_node(number_cluster, ii, temporary_link_list, 1)
            # Record the correction and the DER
            link_tmp = copy.deepcopy(temporary_link_list)
            diar_tmp = copy.deepcopy(init_diar)
            der_track, current_diar, new_vec = track_correction_process(diar_tmp,
                                                                        current_vec_per_seg,
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
            der_track, current_diar, new_vec = track_correction_process(diar_tmp,
                                                                        current_vec_per_seg,
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
            der_track, current_diar, new_vec = track_correction_process(diar_tmp,
                                                                        current_vec_per_seg,
                                                                        scores_per_cluster,
                                                                        link_tmp,
                                                                        der_track,
                                                                        "not_clustering",
                                                                        uem,
                                                                        ref)
    # remove the link we just processed
    links_to_check = np.delete(links_to_check, 0, axis=0)

    # prepare new dendrogram for UI
    tree = scipy.cluster.hierarchy.to_tree(link, rd=False)
    json_tree = add_node(tree, None)
    return dict(tree=json_tree, der_track=der_track, segments=init_diar.segments)


@app.route('/update_init_diar', methods=['POST'])
def update_init_diar():

    global clustering_method, selection_method, conditional_questioning, prioritize_separation2clustering
    global root_folder, show_name, vectors_type

    # Extract json data
    json_str = str(request.get_json())
    json_str = json_str.replace("\'", "\"")
    json_data = json.loads(json_str)

    show_name = json_data['show']
    root_folder = json_data['root_folder']
    clustering_method = json_data['clustering_method']
    selection_method = json_data['selection_method']
    conditional_questioning = (json_data['conditional_questioning'] == 'true')
    prioritize_separation2clustering = (json_data['prioritize_separation2clustering'] == 'true')
    vectors_type = json_data['vectors_type']

    # Create new init diar with the segments
    segments = json_data['segments']
    new_init_diar = Diar()
    if not new_init_diar._attributes.exist('gender'):
        new_init_diar.add_attribut(new_attribut='gender', default='U')
    for seg in segments:
        new_init_diar.append(show=seg[0], cluster=seg[1], cluster_type=seg[2],
                             start=seg[3], stop=seg[4], gender=seg[5])

    # Save the diar to MDTM
    mdtm_path = json_data['mdtm_path']
    allies_write_diar(new_init_diar, mdtm_path)

    # Load config
    system_config = json_data['system_config_path']
    with open(system_config, 'r') as fh:
        model_cfg = yaml.load(fh, Loader=yaml.FullLoader)

    # Edit config
    model_cfg['within_show']['th_w'] = threshold
    model_cfg['within_show']['hac_method'] = clustering_method
    model_cfg['within_show']['selection_method'] = selection_method
    model_cfg['within_show']['conditional_questioning'] = conditional_questioning

    model_cfg["tmp_dir"] = json_data['tmp_dir']
    model_cfg["ref_mdtm_directory"] = ""
    model_cfg["model"]["vad"]["type"] = "from_file"
    model_cfg["model"]["vad"]["dir"] = mdtm_path

    model_cfg["model"]["type"] = "lium_" + vectors_type + "v"
    model_cfg["model"]["vectors"]["type"] = vectors_type

    model_cfg["model"]["vectors"]["xvectors"]["dir"] = json_data['best_xtractor_path']

    # Load model
    model_allies = json_data['model_allies_path']
    with open(model_allies, 'rb') as fh:
        model = pickle.load(fh)

    filename = json_data['wav_file']  # wav file address

    global current_diar, first_pass_diar, current_vec, current_vec_per_seg, first_pass_vec, first_pass_vec_per_seg, scores_per_cluster

    # Init seg
    current_diar, first_pass_diar, current_vec, current_vec_per_seg, first_pass_vec, first_pass_vec_per_seg, scores_per_cluster = allies_init_seg(
        model=model,
        system_config=model_cfg,
        show=show_name,
        file_info=None,
        filename=filename,
        root_folder=root_folder,
        verbose=True)

    return json.dumps("")


@app.route('/next_question', methods=['POST'])
def next_question():
    global no_more_clustering, no_more_separation, links_to_check, node_waiting_for_answer_is_grouped

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
                                                         current_vec_per_seg,
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
                                                                                        current_vec_per_seg,
                                                                                        selection_method)
                node_waiting_for_answer_is_grouped = True
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
                                                         current_vec_per_seg,
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
                                                                                        current_vec_per_seg,
                                                                                        selection_method)
                node_waiting_for_answer_is_grouped = False
                question = dict(segs1=first_seg_list_sorted, segs2=second_seg_list_sorted, node=node.tolist())
                return json.dumps(question)

        links_to_check = np.delete(links_to_check, 0, axis=0)
        length = len(links_to_check)

    # We have reached the end of the while loop without finding question, so there are no more questions to ask
    res = dict(error="No more question")
    return json.dumps(res)


@app.route('/save_file', methods=['POST'])
def save_file():
    json_str = str(request.get_json())
    json_str = json_str.replace("\'", "\"")
    path = json.loads(json_str)['path']
    new_cluster_labels = json.loads(json_str)['new_cluster_labels']
    diar_to_save = copy.deepcopy(current_diar)
    for seg in diar_to_save.segments:
        seg['cluster'] = new_cluster_labels[seg['cluster']]
    allies_write_diar(diar_to_save, path)
    return json.dumps("")


@app.route('/get_segments_from_node', methods=['POST'])
def get_segments_from_node():
    node_id = int(request.form.get('node_id'))
    sort_method = request.form.get('selection_method')

    sort_by_start_time = False
    if sort_method == "start_time":
        sort_by_start_time = True
        sort_method = "longest"

    data = None
    if node_id > number_cluster - 1:
        node = link[node_id - number_cluster]
        first_seg_list_sorted, second_seg_list_sorted = get_segment_sorted_list(node,
                                                                                link,
                                                                                scores_per_cluster,
                                                                                None,
                                                                                init_diar,
                                                                                current_vec_per_seg,
                                                                                sort_method)
        if sort_by_start_time:
            first_seg_list_sorted.sort(key=get_start_time)
            second_seg_list_sorted.sort(key=get_start_time)

        data = dict(segs1=first_seg_list_sorted, segs2=second_seg_list_sorted, node_id=node_id)
    else:
        seg_list_sorted, _ = get_segment_sorted_list([node_id, node_id],
                                                     link,
                                                     scores_per_cluster,
                                                     None,
                                                     init_diar,
                                                     current_vec_per_seg,
                                                     sort_method)
        if sort_by_start_time:
            seg_list_sorted.sort(key=get_start_time)

        data = dict(segs=seg_list_sorted, node_id=node_id)

    return json.dumps(data)


@app.route('/shutdown', methods=['POST'])
def shutdown():
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()
    return json.dumps("")


# take second element for sort
def get_start_time(segment):
    return segment[3]


def correct_link_after_removing_node(number_cluster, node_idx, link_list, removed_nodes_number):
    removed_node_idx = number_cluster + node_idx

    for idx_link in range(node_idx, len(link_list) - 1):

        if link_list[idx_link][0] == removed_node_idx:
            _ = link_list.pop(idx_link)
            return correct_link_after_removing_node(number_cluster, idx_link, link_list, removed_nodes_number + 1)

        elif link_list[idx_link][1] == removed_node_idx:
            _ = link_list.pop(idx_link)
            return correct_link_after_removing_node(number_cluster, idx_link, link_list, removed_nodes_number + 1)

        else:
            if link_list[idx_link][0] > removed_node_idx:
                link_list[idx_link][0] = link_list[idx_link][0] - removed_nodes_number

            if link_list[idx_link][1] > removed_node_idx:
                link_list[idx_link][1] = link_list[idx_link][1] - removed_nodes_number

    return link_list


def allies_init_seg(model, system_config, show, file_info, filename, root_folder, verbose=False):
    model_cfg = system_config

    first_seg_path = f"{model_cfg['tmp_dir']}/seg/first_th{model_cfg['first_seg']['thr_h']}/"
    second_seg_path = first_seg_path + f"second_th{model_cfg['within_show']['th_w']}/"

    if not os.path.isdir(first_seg_path):
        os.makedirs(first_seg_path)
    if not os.path.isdir(second_seg_path):
        os.makedirs(second_seg_path)

    # perform first seg
    if model_cfg["first_seg"]["type"] == "bic":
        print("EXTRACT features")
        if not os.path.isfile(f"{model_cfg['tmp_dir']}/feat/{show}.h5"):
            # Load MFCC
            fe = sidekit.FeaturesExtractor(**model_cfg["model"]["feature_extractor"])
            print(f"compression: {fe.compressed}")
            fe.save(show,
                    channel=0,
                    input_audio_filename=filename,
                    output_feature_filename=f"{model_cfg['tmp_dir']}/feat/{show}.h5")

        fs_seg = sidekit.FeaturesServer(feature_filename_structure=model_cfg['tmp_dir'] + "/feat/{}.h5",
                                        **model_cfg["first_seg"]["feature_server"])

        cep, _ = fs_seg.load(show)

        if model_cfg["model"]["vad"]["type"] == "none":
            init_diar = s4d.segmentation.init_seg(cep, show)
            if verbose: print(f"Initial segments ({len(init_diar)} segs): {len(init_diar.unique('cluster'))} clusters")

        elif model_cfg["model"]["vad"]["type"] == "from_file":
            if 'extention' in model_cfg['model']['vad'] and model_cfg['model']['vad']['extention'] == "uem":
                print(f"Load ref segmentation: {model_cfg['model']['vad']['dir']}/{show}.uem")
                init_diar = s4d.Diar.read_uem(f"{model_cfg['model']['vad']['dir']}/{show}.uem")
            elif 'extention' in model_cfg['model']['vad'] and model_cfg['model']['vad']['extention'] == "seg":
                print(f"Load ref segmentation: {model_cfg['model']['vad']['dir']}/{show}.seg")
                init_diar = s4d.Diar.read_seg(f"{model_cfg['model']['vad']['dir']}/{show}.seg")
            else:
                print(f"Load ref segmentation: {model_cfg['model']['vad']['dir']}")
                # READ MDTM FROM THE FILE
                init_diar = s4d.Diar.read_mdtm(f"{model_cfg['model']['vad']['dir']}")
                for i in range(len(init_diar)):
                    init_diar[i]['cluster'] = "tmp_" + str(i)
            if verbose: print(f"after loading segments ({len(init_diar)} segs): {len(init_diar.unique('cluster'))} clusters")

        if model_cfg["first_seg"]["bic_lin"]:
            # Bic_lin is not useful when loading the reference and hurts a lot
            current_diar = s4d.segmentation.segmentation(cep, init_diar)
            if verbose: print(f"after inital segmentation ({len(current_diar)} segs): {len(current_diar.unique('cluster'))} clusters")
            current_diar = s4d.segmentation.bic_linear(cep, current_diar, model_cfg['first_seg']['thr_l'], sr=False)
            if verbose: print(f"after s4d.bic_linear_{model_cfg['first_seg']['thr_l']} ({len(current_diar)} segs): {len(current_diar.unique('cluster'))} clusters")
        else:
            current_diar = init_diar

        if model_cfg["first_seg"]["hac_bic"]:

            fs_seg = sidekit.FeaturesServer(feature_filename_structure=model_cfg['tmp_dir'] + "/feat/{}.h5",
                                            **model_cfg["first_seg"]["hac_feature_server"])
            cep, _ = fs_seg.load(show)

            hac = s4d.clustering.hac_bic.HAC_BIC(cep, current_diar, model_cfg['first_seg']['thr_h'], sr=False)
            current_diar = hac.perform()

            if verbose: print(f"after s4d.bic_hac_{model_cfg['first_seg']['thr_h']} ({len(current_diar)} segs): {len(current_diar.unique('cluster'))} clusters")

        if model_cfg["first_seg"]["viterbi"]:
            current_diar = s4d.viterbi.viterbi_decoding(cep, current_diar, model_cfg['first_seg']['thr_vit'])
            if verbose: print(f"after s4d.viterbi_{model_cfg['first_seg']['thr_vit']} ({len(current_diar)} segs): {len(current_diar.unique('cluster'))} clusters")

        allies_write_diar(current_diar, f"{first_seg_path}/{show}.mdtm")

    if model_cfg["second_seg"]:

        current_diar = s4d.Diar.read_mdtm(f"{first_seg_path}/{show}.mdtm")

        # Extract segment representation (i-vectors or x-vectors)
        first_pass_vec, first_pass_vec_per_seg = extract_vectors(model, model_cfg, current_diar, root_folder)
        first_pass_vec.write(f"{first_seg_path}/{show}_{model_cfg['model']['vectors']['type']}v.h5")
        first_pass_vec_per_seg.write(f"{first_seg_path}/{show}_{model_cfg['model']['vectors']['type']}v_per_seg.h5")

        # perform the clustering
        first_pass_diar = s4d.Diar.read_mdtm(f"{first_seg_path}/{show}.mdtm")
        current_diar = copy.deepcopy(first_pass_diar)
        current_vec = copy.deepcopy(first_pass_vec)
        current_vec_per_seg = copy.deepcopy(first_pass_vec_per_seg)

        # Perform HAC-xv if necessary
        current_diar, current_vec, current_vec_per_seg, scores = perform_iv_seg(model["model_iv"].norm_mean,
                                                                                model["model_iv"].norm_cov,
                                                                                model["model_iv"].plda_mean,
                                                                                model["model_iv"].plda_f,
                                                                                model["model_iv"].plda_sigma,
                                                                                model_cfg['within_show']['th_w'],
                                                                                current_diar,
                                                                                current_vec,
                                                                                current_vec_per_seg,
                                                                                model_cfg["within_show"][
                                                                                    "hac_method"])

        current_vec.write(f"{second_seg_path}/{show}_{model_cfg['model']['vectors']['type']}v.h5")
        current_vec_per_seg.write(f"{second_seg_path}/{show}_{model_cfg['model']['vectors']['type']}v_per_seg.h5")

        if scores is not None:
            scores.write(f"{second_seg_path}/{show}_{model_cfg['model']['vectors']['type']}v_scores.h5")
        allies_write_diar(current_diar, f"{second_seg_path}/{show}.mdtm")

        if verbose:
            print(
                f"after HAC PLDA {model_cfg['model']['vectors']['type']}vector {model_cfg['within_show']['th_w']} ({len(current_diar)} segs): {len(current_diar.unique('cluster'))} clusters")

    return current_diar, first_pass_diar, current_vec, current_vec_per_seg, first_pass_vec, first_pass_vec_per_seg, scores


if __name__ == "__main__":
    # launch the flask server on a thread
    thread = FlaskThread(app=app)
    thread.start()
