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
var timer;


function highlightNode(node) {

  selectedNode = node;

  //make the node bigger
  d3.select(selectedNode)
    .attr("r",10)
}

function removeHighlight() {

  //reset selected node style to default
  d3.select(selectedNode)
    .attr("r",7)

  //now no node is selected
  selectedNode = null;
  segmentsToDisplay = [];
  clustersToDisplay = [];

  //update display
  displaySegmentDetails([], 1);
  displaySegmentDetails([], 2)
  displayRegions();
}

//display node information on right panel
function displaySegmentDetails(segsIndex, position) {

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

  if (segsIndex.length > 0) {
    let firstSeg = segments[segsIndex[0]];
    let indexCluster = clusters.indexOf(firstSeg[1]);
    let color = colors[indexCluster];
    tag.style.backgroundColor = color ? color : "rgba(71,71,71,255)";
    tag.style.display = "";
    let name = firstSeg[2] + "#" + firstSeg[1];
    spkName.innerHTML = name;
  } else {
    tag.style.display = "none";
    spkName.innerHTML = "Speaker";
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
        clearInterval(timer);
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
        seg.region.play();
        let playIcon = document.getElementById("play");
        playIcon.classList.remove("play");
        playIcon.classList.remove("pause");
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

 //return all segments linked to the node
function getBaseClusterIDs(node, result = []){
    if(!node.children || node.children.length === 0){
        result.push(node.data["node_id"]);
    } else {
        for(i = 0; i < node.children.length; i++) {
            result = getBaseClusterIDs(node.children[i], result);
        }                   
    }
    return result;
}

//update node height / 100 based on the height of the root
function changeNodesHeight(node) {
    graphHeight = height - 40;
    node.y = graphHeight - (node.data.height / rootHeight * graphHeight);
}


function drawDendrogram(data, threshold) {

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

    // Lien entre chaque noeud
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
    var sortedNodes = Array.prototype.slice.call(svg.selectAll("g")._groups[0], 0).sort(sortNodesById);
    colorNodesUpward(sortedNodes);
    colorNodesDownward(sortedNodes, sortedNodes.length - 1, null)
    resizeSVG();
}

function sortNodesById(node1, node2) {
  return node1.__data__.data.node_id - node2.__data__.data.node_id
}

function colorNodesUpward(sortedNodes) {
  for (i = 0; i < sortedNodes.length; i++) {
    let node = sortedNodes[i];
    let cssText = "stroke-width: 2;"
    if (node.__data__.data.children.length == 0) {
      cssText += "fill: " + colors[node.__data__.data.node_id] + ";"
    } else if (node.__data__.data.isGrouped) {
      let childId = node.__data__.data.children[0].node_id;
      cssText = sortedNodes[childId].childNodes[0].style.cssText;
    } else {
      cssText += "fill: black;";
    }
    node.childNodes[0].style.cssText = cssText;
  }
}

//recursively check that the 2 children of a grouped node have the same color
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
      colors[node_id] = cssText.substring(0, end);
  }
}


// Find a parent node from the ids of two children
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

function flashRegion(target) {
  let segID = target.style["data-id"];
  let htmlRegion = wavesurfer.regions.list[segID].element;
  $(htmlRegion).fadeOut(800).fadeIn(800);
  timer = setInterval(function(){ 
      $(htmlRegion).fadeOut(800).fadeIn(800);
  }, 1600);
}


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
    getSegmentsFromNode(nodeId);
  }
}


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