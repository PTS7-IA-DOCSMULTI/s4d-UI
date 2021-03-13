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
    document.getElementById('svg-container').innerHTML = '';

    docWidth = $(document).width();
    docHeight = $(document).height();

    var margin = {top: 20, right: 20, bottom: 50, left: 50},
    width = docWidth - margin.left - margin.right,
    height = docHeight - margin.top - margin.bottom;

    // set the ranges
    var x = d3.scaleLinear().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);

    // define the line
    var valueline = d3.line()
        .x(function(d) { return x(d.x); })
        .y(function(d) { return y(d.y); });

    // appends a 'group' element to 'svg'
    // moves the 'group' element to the top left margin
    var svg = d3.select("#svg-container").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // format the data
    data = []
    derTrack.der_log.forEach(function(d,i) {
        data.push({
            x: i,
            y: d
        })
    });

    // Scale the range of the data
    x.domain([0, d3.max(data, function(d) { return d.x; })]);
    y.domain([0, d3.max(data, function(d) { return d.y; })]);

    // Add the valueline path.
    svg.append("path")
        .data([data])
        .attr("class", "line")
        .attr("d", valueline);

    // Add the X Axis
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    // Add the Y Axis
    svg.append("g")
        .call(d3.axisLeft(y));

    // text label for the x axis
    svg.append("text")             
        .attr("transform",
            "translate(" + (width/2) + " ," + 
                        (height + margin.top + 20) + ")")
        .style("text-anchor", "middle")
        .text("Number of corrections");

    // text label for the y axis
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x",0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("DER");  
        
};
  
window.addEventListener('resize', function(event){
    drawChart();
});
