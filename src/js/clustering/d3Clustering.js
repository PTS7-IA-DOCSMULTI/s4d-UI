/*
 © Copyright 2020-2021 Florian Plaut, Nicolas Poupon, Adrien Puertolas, Alexandre Flucha
 * 
 * This file is part of S4D-UI.
 *
 * S4D-UI is an interface for S4D to allow human supervision of the diarization
 * S4D-UI home page: https://github.com/PTS7-IA-DOCSMULTI/s4d-UI
 * S4D home page: http://www-lium.univ-lemans.fr/s4d/
 * SIDEKIT home page: http://www-lium.univ-lemans.fr/sidekit/
 *
 * S4D-UI is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * S4D-UI is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with S4D-UI.  If not, see <http://www.gnu.org/licenses/>.
*/

//dimensions and margins of the graph
var width = 335;
var height = 335;

var rootHeight;
var selectedNode;
var questionNode;
var flashRegionTimer;
var flashNodeTimer;
var sortedNodes;


/**
  * Make the node of the dendrogram selected by the user bigger.
  *
  * @param node The html node to make bigger.
  */
function highlightNode(node) {
  selectedNode = node;
  d3.select(selectedNode)
    .attr("r",10)
}


/**
  * Restore the selected node to its normal size.
  *
  */
function removeHighlight() {

  //reset selected node style to default
  d3.select(selectedNode)
    .attr("r",7)

  //now no node is selected
  selectedNode = null;
  segmentsToDisplay = [];
  clustersToDisplay = [];

  //update display
  displaySegmentDetails([], 1, false);
  displaySegmentDetails([], 2, false);
  displayRegions();
}


/**
  * Display a table of segments on the selected position.
  *
  * @param {Number[]} segsIndex The array containing the indexes of the segments to display.
  * Each index refers to a segment in the "segments" variable.
  * @param {Number} position The position where we want to display the segments. Value must be 1 or 2.
  * @param {Boolean} severalSpeakers Whether or not the segments to display represent several speakers
  */
function displaySegmentDetails(segsIndex, position, severalSpeakers) {

  if(position < 1 || position > 2) {
    console.error("Position arg must be 1 or 2");
    return;
  }

  segTableId = "segTable" + position;
  let segTable = document.getElementById(segTableId);
  segTable.innerHTML = "";    

  let table = document.createElement('table');
  table.setAttribute('border','0');
  table.setAttribute('width','100%');

  let header = table.createTHead();
  let headerRow = header.insertRow(0); 
  var thStartElement = document.createElement("TH");
  var thEndElement = document.createElement("TH");
  var thPlayElement = document.createElement("TH");
  headerRow.appendChild(thStartElement);
  headerRow.appendChild(thEndElement);
  headerRow.appendChild(thPlayElement);
  thStartElement.innerHTML = "<b>Start</b>";
  thEndElement.innerHTML = "<b>End</b>";
  thPlayElement.innerHTML = "<b>Play</b>";

  let tagID = "speaker-tag" + position;
  let tag = document.getElementById(tagID);

  let spknameID = "spkname" + position;
  let spkName = document.getElementById(spknameID);

  let tbody = table.createTBody();
  let j = 0;

  if (segsIndex.length == 0) {
    tag.style.display = "none";
    spkName.innerHTML = "Speaker";
  } else if (severalSpeakers) {
    tag.style.display = "none";
    spkName.innerHTML = "Several speakers";
  } else  {
    let firstSeg = segments[segsIndex[0]];
    let indexCluster = clusters.indexOf(firstSeg[1]);
    let color = currentColors[indexCluster];
    tag.style.backgroundColor = color ? color : "rgba(71,71,71,255)";
    tag.style.display = "";
    let name = getSpeakerNewName(firstSeg[1]);
    spkName.innerHTML = name;
  }

  for(let i = 0; i < segsIndex.length; i++) {
      //add a row for each segment
      let row = tbody.insertRow(j++);

      //event to flash the region when the mouse is on a row
      let hoverTimer;
      row.addEventListener("mouseenter", function( event ) {
        hoverTimer = setTimeout(function() {
          flashRegion(event.target);
          clearInterval(hoverTimer);
        }, 1000);
      });
      row.addEventListener("mouseleave", function( event ) {
        clearInterval(hoverTimer);
        clearInterval(flashRegionTimer);
      });

      //create elems to add
      let seg = segments[segsIndex[i]]
      let start = document.createTextNode(secondsToHms(seg[3] / 100));
      let end = document.createTextNode(secondsToHms(seg[4] / 100));

      let btns = document.createElement("DIV");
      btns.classList.add("single-button");
      let btn = document.createElement("BUTTON");
      btn.classList.add('action-button');
      btn.innerHTML = "<i class='play icon'></i>";
      btn.onclick = function() {
        isPlayingRegionOnly = true;
        wavesurfer.regions.list[segsIndex[i]].play();
        let playIcon = document.getElementById("play");
        playIcon.classList.remove("play");
        playIcon.classList.add("pause");
      };
      row.style["data-id"] = segsIndex[i];
      btns.appendChild(btn);
      //add elem to row
      row.insertCell(0).appendChild(start);
      row.insertCell(1).appendChild(end);
      row.insertCell(2).appendChild(btns);

  }
  //add elems to html page
  segTable.appendChild(table);
}


/**
  * Update the height of the node in the dendrogram based on his height compared to the height of the root.
  *
  * @param node The html node.
  */
function changeNodesHeight(node) {
    graphHeight = height - 40;
    node.y = graphHeight - (node.data.height / rootHeight * graphHeight);
}


/**
  * Draw the dendrogram from the json tree
  *
  * @param data The json tree.
  */
function drawDendrogram(data) {

    //remove previous dendrogram
    document.getElementById('svg').innerHTML = '';

    rootHeight = data.height;
    // append the svg object to the body of the page
    var svg = d3.select("#svg")
    .append("svg")
	  .attr("class", "scaling-svg")
	  .attr("viewBox", "0 0 "+width+" "+height)
	  .attr("id", "dendrosvg")
    .append("g")
    .attr("transform", "translate(0,15)");  // bit of margin on the top = 15
    
    // read data
    var cluster = d3.cluster()
      .size([ width, height - 40]) // bit of margin on the bottom = 20
      //distance between leaves
      .separation(function(a,b) {
        return 1;
      })
    
    var root = d3.hierarchy(data, function(d) {
        return d.children;
    });
    cluster(root);

    // Link between each node
    svg.selectAll('path')
      .data( root.descendants().slice(1) )
      .enter()
      .append('path')
        // Not the best solution to do this, but it works
        .style("", function(d) {
            changeNodesHeight(d);
        })
        .attr("d", function(d) {
        //Draw two lines to link parent and child 
          return "M" + d.x + "," + d.y
                  + "L" + d.x + "," + d.parent.y
                  + "L" + d.parent.x + "," + d.parent.y;
                })
        .style("fill", "transparent")
        .style("stroke-dasharray", function(d) {
            return d.parent.data.isGrouped ? "0,0" : "5,5";
        })
        .style("stroke", "black")
        
    // add a circle for each node
    svg.selectAll("g")
        .data(root.descendants())
        .enter()
        .append("g")
        .style("cursor", "pointer")
        .attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")"
        })
        .append("circle")
          .attr("r", 7)
          .attr("stroke", "black")
          .style("cursor", "pointer")
          .style("stroke-width", 2)
          .on('click', function(d) { 
            nodeClicked(this)
          })

    // sort nodes by id
    sortedNodes = Array.prototype.slice.call(svg.selectAll("g")._groups[0], 0).sort(sortNodesById);
    colorNodesUpward(sortedNodes);
    colorNodesDownward(sortedNodes, sortedNodes.length - 1, null);
    nameNodesUpward(sortedNodes);
    nameNodesDownward(sortedNodes, sortedNodes.length - 1, null);
    updateRenamingTable(sortedNodes);
    resizeSVG();
}


/**
  * Sorts 2 nodes according to their id, in ascending order
  *
  * @param node1 The first node.
  * @param node2 The second node.
  * @returns Negative value if node1 < node2, positive value if node1 > node2.
  */
function sortNodesById(node1, node2) {
  return node1.__data__.data.node_id - node2.__data__.data.node_id
}


/**
  * Name the tree nodes from bottom to top.
  *
  * @param {Array} sortedNodes The array of nodes sorted by their id.
  */
 function nameNodesUpward(sortedNodes) {
  for (let i = 0; i < clusters.length; i++) {
    let node = sortedNodes[i];
    node.__data__.data.cluster = getClusterFromNodeId(i);
  }
  for (let i = clusters.length - 1; i < sortedNodes.length; i++) {
    let node = sortedNodes[i];
    if (node.__data__.data.isGrouped) {
      //check if left child is renamed
      let leftChild = node.__data__.data.children[0]
      let leftChildCluster = null;
      if (leftChild.children.length == 0) {
        leftChildCluster = getClusterFromNodeId(leftChild.node_id);
      } else {
        leftChildCluster = leftChild.cluster;
      }
      leftChildIsRenamed = renamingTable.links[leftChildCluster].isRenamed
      //check if right child is renamed
      let rightChild = node.__data__.data.children[1]
      let rightChildCluster = null;
      if (rightChild.children.length == 0) {
        rightChildCluster = getClusterFromNodeId(rightChild.node_id);
      } else {
        rightChildCluster = rightChild.cluster;
      }
      rightChildIsRenamed = renamingTable.links[rightChildCluster].isRenamed

      // If no child is renamed, the grouped node takes the name of the left child
      // If only the left child is renamed, takes the name of the left child too
      if(!rightChildIsRenamed) {
        node.__data__.data.cluster = leftChildCluster;
      }
      // If only the right child is renamed, takes the name of the right child
      else if (rightChildIsRenamed) {
        node.__data__.data.cluster = rightChildCluster;
      }
      // If both children are renamed, takes the name of the last child renamed
      else {
        renamingNbLeft = renamingTable.links[leftChildCluster].renamingNumber;
        renamingNbRight = renamingTable.links[rightChildCluster].renamingNumber;
        node.__data__.data.cluster = renamingNbLeft > renamingNbRight ? leftChildCluster : rightChildCluster
      }
    }
  }
}


/**
  * Recursively check that the 2 children of a grouped node have the same cluster name
  *
  * @param {Array} sortedNodes The array of nodes sorted by their id.
  * @param {Number} node_id The id of the node to check
  * @param parent The parent node
  */
 function nameNodesDownward(sortedNodes, node_id, parent) {
  var node = sortedNodes[node_id];
  if (parent && parent.__data__.data.isGrouped) {
    node.__data__.data.cluster = parent.__data__.data.cluster;
  }

  if (node.__data__.data.children.length == 2) {
    var id1 = node.__data__.data.children[0].node_id;
    var id2 = node.__data__.data.children[1].node_id;
    nameNodesDownward(sortedNodes, id1, node);
    nameNodesDownward(sortedNodes, id2, node);   
  }
}

/**
 * Update the renaming table
 * 
 * @param {Array} sortedNodes The array of nodes sorted by their id.
 */
function updateRenamingTable(sortedNodes) {
  for (i = 0; i < clusters.length; i++) {
    let initClusterName = clusters[i];
    let node = sortedNodes[i];
    let currentClusterName = getSpeakerNewName(node.__data__.data.cluster)
    renamingTable.links[initClusterName].newName = currentClusterName
  }
}


/**
  * Colors the tree nodes from bottom to top.
  * A grouped node takes the color of its left child.
  *
  * @param {Array} sortedNodes The array of nodes sorted by their id.
  */
function colorNodesUpward(sortedNodes) {
  for (i = 0; i < sortedNodes.length; i++) {
    let node = sortedNodes[i];
    let cssText = "stroke-width: 2;"
    if (node.__data__.data.children.length == 0) {
      cssText += "fill: " + initialColors[node.__data__.data.node_id] + ";"
    } else if (node.__data__.data.isGrouped) {
      let childId = node.__data__.data.children[0].node_id;
      cssText = sortedNodes[childId].childNodes[0].style.cssText;
    } else {
      cssText += "fill: black;";
    }
    node.childNodes[0].style.cssText = cssText;
  }
}


/**
  * Recursively check that the 2 children of a grouped node have the same color
  *
  * @param {Array} sortedNodes The array of nodes sorted by their id.
  * @param {Number} node_id The id of the node to check
  * @param parent The parent node
  */
function colorNodesDownward(sortedNodes, node_id, parent) {
  var node = sortedNodes[node_id];
  if (parent && parent.__data__.data.isGrouped) {
    node.childNodes[0].style.cssText = parent.childNodes[0].style.cssText;
  }

  if (node.__data__.data.children.length == 2) {
    var id1 = node.__data__.data.children[0].node_id;
    var id2 = node.__data__.data.children[1].node_id;
    colorNodesDownward(sortedNodes, id1, node);
    colorNodesDownward(sortedNodes, id2, node);   
  } else {
      let cssText =  node.childNodes[0].style.cssText
      let start = cssText.indexOf("rgb");
      cssText = cssText.substring(start, cssText.length);
      let end = cssText.indexOf(";");
      currentColors[node_id] = cssText.substring(0, end);
  }
}


/**
  * Find the parent node from the ids of two children
  *
  * @param {Number} childNodeId1 The id of the first child node
  * @param {Number} childNodeId2 The id of the second child node
  * @returns the parent node of the two children
  */
function findParentNode(childNodeId1, childNodeId2) {
  let nodes = d3.selectAll("g")._groups[0]
  for (let i = 1; i < nodes.length; i++) {
    let node = nodes[i]
    if (node.__data__.children) {
      let id1 = node.__data__.children[0].data.node_id
      let id2 = node.__data__.children[1].data.node_id
      if (id1 == childNodeId1 && id2 == childNodeId2) {
        return node;
      }
    }
  }
  return null;
}


/**
 * Find if the left child and the right child of a node represent only one speaker
 * 
 * @param {*} parentNodeId The id of the parent node 
 */
function findIfChildrenIsOneSpeaker(parentNodeId) {
  let childrenNodes = findChildrenNodes(parentNodeId);
    if (childrenNodes) {
      leftNodeIsOneSpeaker = childrenNodes[0].data.isGrouped || childrenNodes[0].data.children.length == 0
      rightNodeIsOneSpeaker = childrenNodes[1].data.isGrouped || childrenNodes[1].data.children.length == 0
    } else {
      leftNodeIsOneSpeaker = true;
      rightNodeIsOneSpeaker = true;
    }
}


/**
 * Return the children of a node from its id
 * 
 * @param {string} parentNodeId The id of the parent node
 * @returns {Array} The array containing the children
 */
function findChildrenNodes(parentNodeId) {
  let nodes = d3.selectAll("g")._groups[0]
  for (let i = 1; i < nodes.length; i++) {
    let node = nodes[i].__data__
    if (node.data.node_id == parentNodeId) {
      if(node.data.children.length == 2) {
        return [node.children[0], node.children[1]]
      }
      break;
    }
  }
  return null;
}


/**
  * Make a region of the waveform appears and disappears
  *
  * @param {Element} target The html region
  */
function flashRegion(target) {
  let segID = target.style["data-id"];
  let htmlRegion = wavesurfer.regions.list[segID].element;
  $(htmlRegion).fadeOut(800).fadeIn(800);
  flashRegionTimer = setInterval(function(){ 
      $(htmlRegion).fadeOut(800).fadeIn(800);
  }, 1600);
}

/**
  * Make a node of the dendrogram appears and disappears
  *
  * @param {Element} target The html node
  */
function flashNode(target) {
  $(target).fadeOut(800).fadeIn(800);
  flashNodeTimer = setInterval(function(){ 
      $(target).fadeOut(800).fadeIn(800);
  }, 1600);
}

/**
  * Manage the selected node when a node is clicked
  *
  * @param {Element} node The html node
  */
function nodeClicked(node) {

  if (node == selectedNode) {
    removeHighlight();
  } else {
    if (selectedNode) {
      removeHighlight();
    }
    selectedNode = node
    highlightNode(selectedNode);

    nodeId = node.__data__.data["node_id"]
    let selection_method = $('#sortcmb1').val()
    getSegmentsFromNode(nodeId, selection_method);
  }
}


/**
  * Resize the dendrogram based on the size of the window
  *
  */
function resizeSVG(){
  var dendrosvg = document.getElementById("dendrosvg");
  var svg = document.getElementById("svg");
  if (!dendrosvg || !svg) return;
  var height = 0
  $('#dendrogramme').children().each(function(e, v) {
    height += $(v).outerHeight(true)
  })
  height -= $('#dendrogramme-header').outerHeight(true)
  dendrosvg.style.maxHeight=height+"px";
  svg.style.paddingBottom=height+"px";
}


$(function(){
    resizeSVG();
});


window.addEventListener('resize', function(event){
    resizeSVG();
});