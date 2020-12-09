//dimensions and margins of the graph
var width = 335;
var height = 335;

var selectedNode_d;
var selectedNode_html;

var segments = [];

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
    createSegmentsFromLeaves(getLeaves(d));
    //make the node bigger
    d3.select(htmlNode)
        .attr("r",10)
        .style("fill", "red");

  //if the clicked node was already selected then no node is selected
  } else {
    selectedNode_d = null;
    segments = [];
  }

  //update display
  displayNodeContent();
  displayRegions();
    
}

function createSegmentsFromLeaves(leaves) {
    segments = [];
    for(var i = 0; i < leaves.length; i++) {
        var leaf = leaves[i].data;
        segments.push({
          name: leaf.name,
          start: leaf.start,
          end: leaf.end
        });
    }
}

//display node information on right panel
function displayNodeContent() {
    var name = selectedNode_d == null ? "" : selectedNode_d.data.name
    document.getElementById("nodeName").innerHTML = "Node name: " + name;
    var segList = document.getElementById("segList")
    segList.innerHTML = "";

    for(let i = 0; i < segments.length; i++) {
        //create elems to add
        let li = document.createElement("li");
        let seg = segments[i];
        let text = document.createTextNode(seg.name + " [" + secondsToHms(seg.start) + " - " + secondsToHms(seg.end) + "]");
        let btn = document.createElement("BUTTON");
        btn.innerHTML = "Play";
        btn.onclick = function() {
            seg.region.play();
        }; 
        //add elems to html page
        li.appendChild(text);
        li.appendChild(btn);
        segList.appendChild(li); 
    }

}

 //return all segments linked to the node
function getLeaves(node, result = []){
    if(!node.children || node.children.length === 0){
        result.push(node);
    }else{
        for(let i = 0; i < node.children.length; i++) {
            result = getLeaves(node.children[i], result);
        }                   
    }
    return result;
}

//update node height based on the JSON file
function changeNodesHeight(node) {
    graphHeight = height - 40;
    node.y = graphHeight - (node.data.height / 100 * graphHeight);
}

function drawDendrogram() {
    
    // append the svg object to the body of the page
    var svg = d3.select("#svg")
    .append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(0,20)");  // bit of margin on the top = 20
    
    // read json data
    d3.json("./test.json", function(data) {
    var cluster = d3.cluster()
      .size([ width, height - 40]) // bit of margin on the bottom = 20
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
            return d.depth == 1 ? "5,5" : "0,0";
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
          })
    });
}