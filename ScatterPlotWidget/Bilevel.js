var Bilevel = function() {

// http://bl.ocks.org/mbostock/5944371
var _private = {

margin : {top: 180, right: 180, bottom: 180, left: 180},
radius : 0, //Math.min(margin.top, margin.right, margin.bottom, margin.left),
hue : d3.scale.category10(),

luminance : d3.scale.sqrt()
    .domain([0, 1e6])
    .clamp(true)
    .range([90, 20]),

svg : null,

partition : d3.layout.partition()
    .sort(function(a, b) { return d3.ascending(a.name, b.name); }),

arc : d3.svg.arc()
    .startAngle(function(d) { return d.x; })
    .endAngle(function(d) { return d.x + d.dx ; })
    .padAngle(.01),

key : function(d) {
  var k = []; p = d;
  while (p.depth) k.push(p.name), p = p.parent;
  return k.reverse().join(".");
},

fill : function (d) {
  var p = d;
  while (p.depth > 1) p = p.parent;
  var c = d3.lab(_private.hue(p.name));
  c.l = _private.luminance(d.sum);
  return c;
},

arcTween : function(b) {
  var i = d3.interpolate(this._current, b);
  this._current = i(0);
  return function(t) {
    return _private.arc(i(t));
  };
},

updateArc : function (d) {
  return {depth: d.depth, x: d.x, dx: d.dx};
},

}

var _public = {

init : function(dataFile) {
  _private.radius = Math.min(_private.margin.top, _private.margin.right, _private.margin.bottom, _private.margin.left);
  
  _private.svg = d3.select("body").append("svg")
    .attr("width", _private.margin.left + _private.margin.right + 20)
    .attr("height", _private.margin.top + _private.margin.bottom + 20)
  .append("g")
    .attr("transform", "translate(" + (_private.margin.left+10) + "," + (_private.margin.top+10) + ")");

  _private.partition.size([2 * Math.PI, _private.radius]);

  _private.arc.padRadius(_private.radius / 3)
    .innerRadius(function(d) { return _private.radius / 3 * d.depth; })
    .outerRadius(function(d) { return _private.radius / 3 * (d.depth + 1) - 1; });

  d3.json(dataFile, function(error, root) {

    // Compute the initial layout on the entire tree to sum sizes.
    // Also compute the full name and fill color for each node,
    // and stash the children so they can be restored as we descend.
    _private.partition
        .value(function(d) { return d.size; })
        .nodes(root)
        .forEach(function(d) {
          d._children = d.children;
          d.sum = d.value;
          d.key = _private.key(d);
          d.fill = _private.fill(d);
        });

    // Now redefine the value function to use the previously-computed sum.
    _private.partition
        .children(function(d, depth) { return depth < 2 ? d._children : null; })
        .value(function(d) { return d.sum; });

    var center = _private.svg.append("circle")
        .attr("r", _private.radius / 3)
        .on("click", zoomOut);

    center.append("title")
        .text("zoom out");

    var path = _private.svg.selectAll("path")
        .data(_private.partition.nodes(root).slice(1))
      .enter().append("path")
        .attr("d", _private.arc)
        .style("fill", function(d) { return d.fill; })
        .each(function(d) { this._current = _private.updateArc(d); })
        .on("click", zoomIn);

    function zoomIn(p) {
      if (p.depth > 1) p = p.parent;
      if (!p.children) return;
      zoom(p, p);
    }

    function zoomOut(p) {
      if (!p.parent) return;
      zoom(p.parent, p);
    }

    // Zoom to the specified new root.
    function zoom(root, p) {
      if (document.documentElement.__transition__) return;

      // Rescale outside angles to match the new layout.
      var enterArc,
          exitArc,
          outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);

      function insideArc(d) {
        return p.key > d.key
            ? {depth: d.depth - 1, x: 0, dx: 0} : p.key < d.key
            ? {depth: d.depth - 1, x: 2 * Math.PI, dx: 0}
            : {depth: 0, x: 0, dx: 2 * Math.PI};
      }

      function outsideArc(d) {
        return {depth: d.depth + 1, x: outsideAngle(d.x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x)};
      }

      center.datum(root);

      // When zooming in, arcs enter from the outside and exit to the inside.
      // Entering outside arcs start from the old layout.
      if (root === p) enterArc = outsideArc, exitArc = insideArc, outsideAngle.range([p.x, p.x + p.dx]);

      path = path.data(_private.partition.nodes(root).slice(1), function(d) { return d.key; });

      // When zooming out, arcs enter from the inside and exit to the outside.
      // Exiting outside arcs transition to the new layout.
      if (root !== p) enterArc = insideArc, exitArc = outsideArc, outsideAngle.range([p.x, p.x + p.dx]);

      d3.transition().duration(d3.event.altKey ? 7500 : 750).each(function() {
        path.exit().transition()
            .style("fill-opacity", function(d) { return d.depth === 1 + (root === p) ? 1 : 0; })
            .attrTween("d", function(d) { return _private.arcTween.call(this, exitArc(d)); })
            .remove();

        path.enter().append("path")
            .style("fill-opacity", function(d) { return d.depth === 2 - (root === p) ? 1 : 0; })
            .style("fill", function(d) { return d.fill; })
            .on("click", zoomIn)
            .each(function(d) { this._current = enterArc(d); });

        path.transition()
            .style("fill-opacity", 1)
            .attrTween("d", function(d) { return _private.arcTween.call(this, _private.updateArc(d)); });
      });
    }
  });
}};
    return _public;

}();


Bilevel.init("flare.json");