//dimensions and margins of the graph
var width = 335;
var height = 335;

var rootHeight;

var selectedNode;
var segments = [];
var clusters = [];
var segsToDisplay = [];
var clustersToDisplay = [];

var timer;

function highlightNode(node) {

  selectedNode = node;
  d = node.__data__;
  htmlNode = node.children[0];

  //make the node bigger
  d3.select(htmlNode)
    .attr("r",10)
    .style("fill", "red");

  //update display
  generateSegsToDisplay(getBaseClusterIDs(d));
  displaySegmentDetails();
  displayRegions();
}

function removeHighlight() {
  //set default style to the previous node selected
  d3.select(selectedNode.children[0])
      .attr("r",7)
      .style("fill", "#69b3a2");

  //now no node is selected
  selectedNode = null;
  segsToDisplay = [];
  clustersToDisplay = [];

  //update display
  displaySegmentDetails();
  displayRegions();
}

function generateSegsToDisplay(baseClusterIDs) {
    clusterNames = [];
    for(let i = 0; i < baseClusterIDs.length; i++) {
      clusterNames.push(clusters[baseClusterIDs[i]]);
    }
    clustersToDisplay = baseClusterIDs;
    segsToDisplay = segments.filter(seg => clusterNames.includes(seg[1]));
}

//display node information on right panel
function displaySegmentDetails() {
    var name = selectedNode == null ? "" : selectedNode.__data__.data.name
    var segTable = document.getElementById("segTable");
    segTable.innerHTML = "";

    var table = document.createElement('table');
    table.setAttribute('border','1');
    table.setAttribute('width','100%');

    var header = table.createTHead();
    let headerRow = header.insertRow(0); 
    headerRow.insertCell(0).innerHTML = "<b>Start</b>";
    headerRow.insertCell(1).innerHTML = "<b>End</b>";
    headerRow.insertCell(2).innerHTML = "<b>Speaker</b>";
    headerRow.insertCell(3).innerHTML = "<b>Type</b>";
    headerRow.insertCell(4).innerHTML = "<b>Play</b>";

    var tbody = table.createTBody();
    var j = 0;

    for(let i = 0; i < segsToDisplay.length; i++) {
        //add a row for each segment
        let row = tbody.insertRow(j++);

        //event to flash the region when the mouse is on a row
        row.addEventListener("mouseenter", function( event ) {
          flashRegion(event.target);
        });
        row.addEventListener("mouseleave", function( event ) {
          clearInterval(timer);
        });

        //create elems to add
        let seg = segsToDisplay[i];
        let start = document.createTextNode(secondsToHms(seg[3] / 100));
        let end = document.createTextNode(secondsToHms(seg[4] / 100));
        let speaker = document.createTextNode("Unknown");
        let type = document.createTextNode("Unknown");

		    let btns = document.createElement("DIV");
		    btns.classList.add("single-button");
        let btn = document.createElement("BUTTON");
		    btn.classList.add('action-button');
        btn.innerHTML = "<i class='play icon'></i>";
        btn.onclick = function() {
          seg.region.play();
  		    var playIcon = document.getElementById("play");
  		    playIcon.classList.remove("play");
  		    playIcon.classList.remove("pause");
  		    playIcon.classList.add("pause");
        };
		    btns.appendChild(btn);
        //add elem to row
        row.insertCell(0).appendChild(start);
        row.insertCell(1).appendChild(end);
        row.insertCell(2).appendChild(speaker);
        row.insertCell(3).appendChild(type);
        row.insertCell(4).appendChild(btns);
          
    }
    //add elems to html page
    segTable.appendChild(table);
}

 //return all segments linked to the node
function getBaseClusterIDs(node, result = []){
    if(!node.children || node.children.length === 0){
        result.push(node.data["node_id"]);
    } else {
        for(let i = 0; i < node.children.length; i++) {
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

function loadSegments(data) {
    segments = data;
}

function loadClusters(data) {
    clusters = data;
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

    // Lien entre chaque noeuds
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
        .attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")"
        })
        .append("circle")
          .attr("r", 7)
          .style("fill", "#69b3a2")
          .attr("stroke", "black")
          .style("stroke-width", 2)

    resizeSVG();
}

// Load the question sent by the system
function loadQuestion(question) {
  // first find the node concerned by the question
  let node = findParentNode(question.node[0], question.node[1]);
  //highlight the node
  highlightNode(node);
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
  let index = getRowIndexInTable(target);
  let i = 0;
  let htmlRegion;
  for (let id in wavesurfer.regions.list) {
    if (i++ == index) {
      htmlRegion = wavesurfer.regions.list[id].element
      break;
    }
  }
  $(htmlRegion).fadeOut(800).fadeIn(800);
  timer = setInterval(function(){ 
      $(htmlRegion).fadeOut(800).fadeIn(800);
  }, 1600);
}

function getRowIndexInTable(target) {
  segTable = document.getElementById("segTable");
  tbody = segTable.children[0].children[1];
  for (i = 0; i < tbody.children.length; i++) {
    row = tbody.children[i];
    if (target == row) {
      return i;
    }
  }
  return -1
}


window.addEventListener('load', (event) => {
  displaySegmentDetails();
});

$(window).on('load', function () {
    $(window).resize();
});

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