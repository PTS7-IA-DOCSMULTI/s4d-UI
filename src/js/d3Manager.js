//dimensions and margins of the graph
var width = 335;
var height = 335;

var rootHeight;

var selectedNode_d;
var selectedNode_html;

var segments = [];
var clusters = [];
var segsToDisplay = [];
var clustersToDisplay = [];

//call when a node is clicked
function nodeClick(d, htmlNode) {

  //set default style to the previous node selected
  d3.select(selectedNode_html)
      .attr("r",7)
      .style("fill", "#69b3a2");
  selectedNode_html = htmlNode;

  //if the clicked node is different from the previous one
  if(selectedNode_d !== d) {
    selectedNode_d = d;
    generateSegsToDisplay(getBaseClusterIDs(d));
    //make the node bigger
    d3.select(htmlNode)
        .attr("r",10)
        .style("fill", "red");

  //if the clicked node was already selected then no node is selected
  } else {
    selectedNode_d = null;
    segsToDisplay = [];
    clustersToDisplay = [];
  }

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
    var name = selectedNode_d == null ? "" : selectedNode_d.data.name
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

function loadDERLog(data) {
  console.log(data);
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
            return d.parent.data.height > threshold ? "5,5" : "0,0";
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
          .style("cursor", "pointer")
          .style("stroke-width", 2)
          .on('click', function(d) { 
            nodeClick(d, this);
          });

    resizeSVG();
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
  $('#dendrogramme-header').children().each(function(e, v) {
    height -= $(v).outerHeight(true)
  })
  dendrosvg.style.maxHeight=height+"px";
  svg.style.paddingBottom=height+"px";
}

$(function(){
    resizeSVG();
});

window.addEventListener('resize', function(event){
    resizeSVG();
});