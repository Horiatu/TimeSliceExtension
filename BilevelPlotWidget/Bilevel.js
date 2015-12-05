var Bilevel = function() {

// http://bl.ocks.org/mbostock/5944371
var _private = {

margin : {top: 220, right: 200, bottom: 200, left: 200},
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
    .endAngle(function(d) { return d.x + d.dx; })
    .padAngle(.01),

key : function(d) {
  var k = []; p = d;
  while (p.depth) k.push(p.name), p = p.parent;
  return k.reverse().join(" > ");
},

fill : function (d) {
  var p = d;
  while (p.depth > 1) p = p.parent;
  var c = d3.lab(_private.hue(p.name));
  c.l = _private.luminance((6-d.depth) * d.sum * 10000);
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

  Clear : function() {
    // _private.partition = d3.layout.partition()
    //   .sort(function(a, b) { return d3.ascending(a.name, b.name); });
  },

  Plot : function(root) {

    console.log(root, _private.partition.nodes(root))

    // Compute the initial layout on the entire tree to sum sizes.
    // Also compute the full name and fill color for each node,
    // and stash the children so they can be restored as we descend.

    _private.partition
        .value(function(d) { 
          return d.size; 
        })
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

    var center = d3.select('#center');
    if(!center || !center[0][0]) {
      var logo=_private.svg.append("defs").append("pattern")
        .attr('id', "logo")
        .attr('patternUnits', 'userSpaceOnUse')
         .attr('width', 400)
         .attr('height', 400)
         .attr('x', -_private.radius*1.6/6)
         .attr('y', -_private.radius*1.6/6)
         .append("image")
         .attr("xlink:href", "CanadaMapComunityLogo.thumbnail.png")
         .attr('width', _private.radius*1.6/3)
         .attr('height', _private.radius*1.6/3);

      center = _private.svg.append("circle")
          .attr('id','center')
          .attr("r", _private.radius / 3)
          .on("click", zoomOut);

      center
      .append('g').append('image')
        .attr("xlink:href", "CanadaMapComunityLogo-64x64.png")
         .attr('width', 64)
         .attr('height', 64);

      center.append("title").text("zoom out");
    }
    else {
      center = center[0][0];
    }

    var path = _private.svg.selectAll("path")
        .data(_private.partition.nodes(root).slice(1))
      .enter().append("path")
        .attr("d", _private.arc)
        .style("fill", function(d) { return d.fill; })
        .each(function(d) { this._current = _private.updateArc(d); })
        .on("click", zoomIn);

// path.each(function() {

//    d3.select( this.parentNode ).insert("node", function(){return this;} ) 
//               //insert a new <g> element immediately before this element
//      .attr("class", "wrapper") //set anything you want to on the <g>
//      .append( function(){return this;} );
//              //move the content element into the group

// });
    //debugger

    lastId = 0
    g = d3.select('g')

    function addCaption(paths)
    {
      g.select('text.pathLabel').remove();
      g.select('path.helperPath').remove();
      paths.select("title").remove();
      paths.each(function(d) { 
        if(this.attributes['d'] != undefined) {
          var x = this.attributes['d'].nodeValue.match(/M(\d|\.|,|\s|-)+A(\d|\.|,|\s|-)+/)[0];
          var l = d.fill.l;
          var txtColor = l<70 ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.85)';
          //console.log(l, txtColor);
          var id = 'p'+(lastId++);

          g.append('path').attr('d',x).attr('id',id).attr('class', 'helperPath');
          var plen = d3.select('#'+id)[0][0].getTotalLength() * 0.90;
          
          var label=d.name+': '+d.sum;
          var t = g.append('text').attr('id', 'xxx').attr('class', 'pathLabel').text(label);
          var tlen = t[0][0].clientWidth;
          g.select('#xxx').remove();
          if(plen >= tlen) {
            g.append('text')
              .attr('class', 'pathLabel')
              .attr('x', '2%')
              .attr('dy', 20)
            .append('textPath')
              .attr('xlink:href', '#'+id).attr('id', 't'+id).append('tspan').style('fill',txtColor).text(label);
          }
          d3.select(this).append("title").text(label);
        }
      });
    }

    addCaption(path);

    function zoomIn(p) {
      if (p.depth > 1) p = p.parent;
      d3.select("#key h1")[0][0].innerHTML = p.key+": "+p.sum;
      if (!p.children) return;
      zoom(p, p);
      //addCaption(path);
    }

    function zoomOut(p) {
      if (!p || !p.parent) return;
      d3.select("#key h1")[0][0].innerHTML = (p.parent.key!=''?(p.parent.key+": "):'Total: ')+p.parent.sum;
      zoom(p.parent, p);
      //addCaption(path)
    }

    // Zoom to the specified new root.
    function zoom(root, p) {
      if (document.documentElement.__transition__) return;

      //console.log(root, p);

      // Rescale outside angles to match the new layout.
      var enterArc,
          exitArc,
          outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);

      function insideArc(d) {
        //debugger
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
            .each(function(d, i) {
              //console.log('start', this, i, d)
              d3.select('text.pathLabel').remove();
              d3.select('path.helperPath').remove();
              d3.select(this).select("title").remove();
            })
            .remove();

        path.enter().append("path")
            .style("fill-opacity", function(d) { return d.depth === 2 - (root === p) ? 1 : 0; })
            .style("fill", function(d) { return d.fill; })
            .on("click", zoomIn)
            .each(function(d) { this._current = enterArc(d); });

        path.transition()
            .style("fill-opacity", 1)
            .attrTween("d", function(d) { return _private.arcTween.call(this, _private.updateArc(d)); })
            .each('start', function(d, i) {
              //console.log('start', this, i, d)
              d3.select('text.pathLabel').remove();
              d3.select('path.helperPath').remove();
              d3.select(this).select("title").remove();
            })
            .each('end', function(d, i) {
              //console.log('end')
              var x = this.attributes['d'].nodeValue.match(/M(\d|\.|,|\s|-)+A(\d|\.|,|\s|-)+/)[0];
              var l = d.fill.l;
              var txtColor = l<70 ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.85)';
              //console.log(l, txtColor);
              var id = 'p'+i;
              //if(this.id == '' ) this.id=id;

              g.append('path').attr('d',x).attr('id',id).attr('class', 'helperPath');
              var plen = d3.select('#'+id)[0][0].getTotalLength() * 0.90;
              //var bbox = d3.select('#t'+id)[0][0].getBBox();
              
              var label=d.name+': '+d.sum;
              var t = g.append('text').attr('id', 'xxx').attr('class', 'pathLabel').text(label);
              var tlen = t[0][0].clientWidth;
              g.select('#xxx').remove();
              if(plen >= tlen) {
                g.append('text')
                  .attr('class', 'pathLabel')
                  .attr('x', '2%')
                  .attr('dy', 20)
                .append('textPath')
                  .attr('xlink:href', '#'+id).attr('id', 't'+id).append('tspan').style('fill',txtColor).text(label);
              }
              d3.select(this).append("title").text(label);

            });
      });
    }
  },

Init : function(dataFile, width) {
  var m = width/2-20;
  _private.margin = {top: m, right: m, bottom: m, bottom: m, left: m};
  _private.radius = Math.min(_private.margin.top, _private.margin.right, _private.margin.bottom, _private.margin.bottom);
  
  var div = d3.select("#BilevelPlotDiv");

  _private.svg = //d3.select("body")
  div.append("svg")
    .attr("width", _private.margin.left + _private.margin.right + 20)
    .attr("height", _private.margin.top + _private.margin.bottom + 20)
  .append("g")
    .attr("transform", "translate(" + (_private.margin.left+10) + "," + (_private.margin.top+10) + ")");

  _private.partition.size([2 * Math.PI, _private.radius]);

  _private.arc.padRadius(_private.radius / 3)
    .innerRadius(function(d) { return _private.radius / 3 * d.depth; })
    .outerRadius(function(d) { return _private.radius / 3 * (d.depth + 1) - 1; });

  d3.json(dataFile, function(error, root) {
    Bilevel.Plot(root);
  });

}};
    return _public;

}();


//Bilevel.init("flare.json");