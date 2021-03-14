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

const fs = require('fs');
var path = require('path');

var derTrack;
var svg;
var xScale;
var yScale;

window.addEventListener('load', function () {
    loadDER();
    drawChart();
});

function loadDER() {
    //load DER
 	var jsonPath = path.join(__dirname, '..', 'der.json');
    derTrack = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function drawChart() {

    // remove previous chart
    document.body.innerHTML = '';

    var docWidth = $(document).width();
    var docHeight = $(document).height();

    var margin = {
        top: 20,
        right: 20,
        bottom: 50,
        left: 50
    }

    chartWidth = docWidth - margin.left - margin.right,
    chartHeight = docHeight - margin.top - margin.bottom;

    // set the ranges
    xScale = d3.scaleLinear().range([0, chartWidth]);
    yScale = d3.scaleLinear().range([chartHeight, 0]);

    // define the line
    var valueline = d3.line()
        .x(function(d) { return xScale(d.x); })
        .y(function(d) { return yScale(d.y); });

    // appends a 'group' element to 'svg'
    // moves the 'group' element to the top left margin
    svg = d3.select("body").append("svg")
        .attr("id", "svg")
        .attr("width", docWidth)
        .attr("height", docHeight)
    .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // format the data
    data = []
    derTrack.der_log.forEach(function(d,i) {
        data.push({
            x: i,
            y: d,
            correction: derTrack.correction[i]
        })
    });

    // Scale the range of the data
    xScale.domain([0, d3.max(data, function(d) { return d.x; })]);
    yScale.domain([0, d3.max(data, function(d) { return d.y; })]);

    // Add the valueline path.
    svg.append("path")
        .data([data])
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", "2px")
        .attr("d", valueline);

    // Add the X Axis
    svg.append("g")
        .attr("transform", "translate(0," + chartHeight + ")")
        .call(d3.axisBottom(xScale));

    // Add the Y Axis
    svg.append("g")
        .call(d3.axisLeft(yScale));

    // text label for the x axis
    svg.append("text")             
        .attr("transform",
            "translate(" + (chartWidth/2) + " ," + 
                        (chartHeight + margin.bottom - 10) + ")")
        .style("text-anchor", "middle")
        .text("Number of corrections");

    // text label for the y axis
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x",0 - (chartHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Diarization Error Rate (%)");  

     // Add the circles
     svg.selectAll("circles")
     .data(data)
     .enter()
     .append("circle")
        .attr("fill", "steelblue")
        .attr("stroke", "none")
        .attr("cx", function(d) { return xScale(d.x) })
        .attr("cy", function(d) { return yScale(d.y) })
        .attr("r", 5)
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut);
        
};
  
window.addEventListener('resize', function(event){
    drawChart();
});

function handleMouseOver(d, i) {  // Add interactivity

    this.setAttribute("fill", "orange")
    this.setAttribute("r", 10)

     svg.append("text")
        .attr("id", "t-" + i)
        .attr("x", getX(d))
        .attr("y", getY(d))
        .attr("fill", "white")
     d3.select("#t-" + i)
        .text(function() {
            return d.correction + " " + d.y.toFixed(2) + "%";  // Value of the text
        });
  }

function handleMouseOut(d, i) {
    
    this.setAttribute("fill", "steelblue")
    this.setAttribute("r", 5)

    d3.select("#t-" + i).remove();  // Remove text location
}

function getX(d) {
    res = xScale(d.x);
    if (res + 250 > $("#svg").width()) {
        res = $("#svg").width() - 250
    }
    return res;
}

function getY(d) {
    res = yScale(d.y) - 20;
    if (res < 0) {
        res = 40;
    }
    return res;
}


