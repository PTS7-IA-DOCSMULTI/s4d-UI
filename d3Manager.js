var width = 335;
var height = 335;

//call when a node is clicked
function nodeClick(d) {
    segments = getLeaves(d);
    loadNode(d.data.name, segments);
    loadPeriods(segments);
}

//display node information on right panel
function loadNode(name, segments) {
    document.getElementById("nodeName").innerHTML = "Node name: " + name;
    let segList = document.getElementById("segList");
    segList.innerHTML = "";

    for(var i = 0; i < segments.length; i++) {
        var li = document.createElement("li");
        var seg = segments[i].data;
        var text = document.createTextNode(seg.name + " [" + secondsToHms(seg.start) + " - " + secondsToHms(seg.end) + "]");
        li.appendChild(text);
        segList.appendChild(li);
    }
}

 //return all segments linked to the node
function getLeaves(node, result = []){
    if(!node.children || node.children.length === 0){
        result.push(node);
    }else{
        for(var i = 0; i < node.children.length; i++) {
            result = getLeaves(node.children[i], result);
        }                   
    }
    return result;
}


function changeNodesHeight(node) {
    graphHeight = height - 40;
    node.y = graphHeight - (node.data.height / 100 * graphHeight);
}

function mouseover() {
    d3.select(this)
        .attr("r",10)
        .style("fill", "red")
}

function mouseout() {
    d3.select(this)
        .attr("r",7)
        .style("fill", "#69b3a2")
}

function drawDendrogram() {
 // set the dimensions and margins of the graph
    
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
        
    
    // Cercle à chaque noeud
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
          .on("mouseover", mouseover)
          .on("mouseout", mouseout)
          .on("click", function(d) {
            nodeClick(d)
            })
    });
}