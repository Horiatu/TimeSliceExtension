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

  total : 0,

  partition : d3.layout.partition().sort(function(a, b) { return d3.ascending(a.name, b.name); }),

  arc : d3.svg.arc()
      .startAngle(function(d) { return d.x; })
      .endAngle(function(d) { return d.x + d.dx; })
      .padAngle(0.01),

  key : function(d) {
    var k = []; p = d;
    while (p.depth) k.push([p.name, p.sum, this.fill(d), this.txtColor(d), p.nid]), p = p.parent;
    return k.reverse();
  },

  fill : function (d) {
    var p = d;
    while (p.depth > 1) p = p.parent;
    var c = d3.lab(_private.hue(p.name));
    c.l = this.lum(d);
    return c;
  },

  lum : function(d) {
    return _private.luminance((6-d.depth) * d.sum * 150000 / Math.min(1, _private.total)/5);
  },

  txtColor : function(d) {
    return this.lum(d)<60 ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
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

  //dragX :0,
  dragY :0,
  drag : d3.behavior.drag()
    .on("dragstart", function(){
        //console.log("dragstart", d3.event, d3.event.sourceEvent, d3.event.sourceEvent.srcElement);
        //dragX = d3.event.sourceEvent.offsetX;
        dragY = d3.event.sourceEvent.offsetY;

        d3.select(d3.event.sourceEvent.srcElement)
        .classed('dragKey',true)
        .style('top',d3.event.sourceEvent.y-dragY+'px');
    })
    .on("drag", function(){
        //console.log("drag", d3.event);
        d3.select(d3.event.sourceEvent.srcElement).style('top',d3.event.sourceEvent.y-dragY+'px');
    })
    .on("dragend", function(){
        //console.log("dragend", d3.event);

        // var dragKey = d3.event.sourceEvent.srcElement;
        // var fixKeys = d3.selectAll('.keys:not(.dragKey)')[0];
        //var top = {top:d3.event.sourceEvent.srcElement.offsetTop, data:d3.select(d3.event.sourceEvent.srcElement).data()[0]};
        var fixTops = d3.selectAll('.keys')[0].map(function(m) {
          return {top:m.offsetTop, data:d3.select(m).data()[0]};
        });

        fixTops.sort(function(a,b) { return a.top - b.top; });
        var data = fixTops.map(function(m) { 
          return m.data; 
        });

        d3.select('#key').selectAll('.keys').remove();
        _private.renderKeys(data);
        d3.select('#refreshBtn').classed('hideOpac', false);
    }),

    renderKeys : function(data) {
      var lis = d3.select('#key').selectAll('div.keys').data(data);
      var li = lis.enter().append('div').attr('class','keys')
      .style('background-color',function(k) { return k[2]; })
      .style('color',function(k) { return k[3]; });
      li.append('div').attr('class','keyName').text(function(k) { return k[0]; });
      li.append('div').attr('class','keyValue').text(function(k) { return k[1]; });

      lis.exit().remove();

      d3.selectAll(".keys").call(_private.drag);
    }

};

  var _public = {

    Init : function(width) {
      var m = width/2-10;
      _private.margin = {top: m, right: m, bottom: m, left: m};
      _private.radius = Math.min(_private.margin.top, _private.margin.right, _private.margin.bottom, _private.margin.bottom);
      _private.partition = d3.layout.partition().sort(function(a, b) { return d3.ascending(a.name, b.name); }); 
      _private.partition.size([2 * Math.PI, _private.radius]);
      _private.arcLabelFontSize = (_private.radius>200) ? 16 : 11;
    },

    Plot : function(root) {
      var div = d3.select("#BilevelPlotDiv");
      div[0][0].innerHTML ='';


      _private.total = 0;
      root.children.forEach(function(r) {
        _private.total += r.fids.length;
      });

      _private.svg = 
        div.append("svg")
          .attr("width", _private.margin.left + _private.margin.right + 20)
          .attr("height", _private.margin.top + _private.margin.bottom + 20)
        .append("g")
          .attr("transform", "translate(" + (_private.margin.left+10) + "," + (_private.margin.top+10) + ")");

      _private.arc.padRadius(_private.radius / 3)
        .innerRadius(function(d) { return d.depth * _private.radius / 3; })
        .outerRadius(function(d) { return (d.depth + 1) * _private.radius / 3 - 1; });


      // console.log(root, _private.partition.nodes(root))

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
            d.txtColor = _private.txtColor(d);
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
          
        center.append("title").text("zoom out");
        var fs = _private.radius/10;
        d3.select('g').append('text')
            .attr('x', 0).attr('y',_private.radius/6+fs/2)
            .attr('id', 'countText')
            .attr('title', 'Total')
            .style('font-size',fs+'px')
            .text('');
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

      g = d3.select('g');

      function render(data, i) {
        var firstArcSection = /(^.+?A((-?\d+(\.\d+)?)\s+){2})(([0|1])\s){3}((-?\d+(\.\d+)?)\s*){2}/;
        var x = firstArcSection.exec( d3.select(this).attr("d").replace(/,/g , " ") )[0];
        var l = data.fill.l;
        var txtColor = data.txtColor;
        var id = 'p'+i;

        var parc = g.append('path').attr('d',x).attr('id',id).attr('class', 'helperPath')[0][0];
        var plen = parc.getTotalLength();
        
        var getLength = function(text, fs) {
          var t = g.append('text')
          .attr('id', 'xxx')
          .attr('class', 'pathLabel')
          .style('font-size', fs)
          .text(text);
          var tlen = t[0][0].clientWidth;
          g.select('#xxx').remove();
          return tlen;
        };

        

        var pc = (data.sum/total*100).toFixed(0)+'%';
        var label=data.name+': '+data.sum + ' ('+pc+')';
        d3.select(this).append("title").text(label);

        var tlen = getLength(label, _private.arcLabelFontSize);
        if(plen * 0.90 < tlen) {
          tlen = getLength(label = data.sum + ' ('+pc+')', _private.arcLabelFontSize);

          if(plen * 0.90 < tlen) {
            tlen = getLength(label = pc, _private.arcLabelFontSize);
          }
        }

        if(plen * 0.90 >= tlen) {

          // http://www.visualcinnamon.com/2015/09/placing-text-on-arcs.html
          var p0 = parc.getPointAtLength(0);
          var p1 = parc.getPointAtLength(plen);
          
          dy = _private.arcLabelFontSize*1.4;
          if(p0.x > p1.x) {
            
            var xxx = /0 (?:0|1) 1/.exec(x)[0];
            var newStart = x.match(xxx+'(.*?)$')[1];
            var middleSec = x.match('A(.*?)'+xxx)[1];
            var newEnd = /M(.*?)A/.exec( x )[1];
            
            //Build up the new arc notation, set the sweep-flag to 0
            var newArc = "M" + newStart + "A" + middleSec + '1 '+xxx[2]+' 0 ' + newEnd;
            d3.select(parc).attr('d',newArc);
            dy = -13/dy-10;
          }

          g.append('text')
            .attr('class', 'pathLabel')
            .attr('x', (plen-tlen)/2)
            .attr('dy', dy)
          .append('textPath')
            .attr('xlink:href', '#'+id)
            .attr('id', 't'+id)
            .append('tspan')
            .style('fill',txtColor)
            .style('font-size',_private.arcLabelFontSize+'px')
            .text(label);
        }
      }

      total = 0;
      function addCaption(paths)
      {
        g.select('text.pathLabel').remove();
        g.select('path.helperPath').remove();
        paths.select("title").remove();
        paths.each(function(p,i) { if(p.depth == 1) total += p.sum; });
        renderKeys('', total);
        paths.each(render);
      }

      function renderKeys(key, t) {
        d3.select("#countText")[0][0].innerHTML = total = t;
        var keys = [];
        if(key !== '') {
          keys = key;
        }

        _private.renderKeys(keys);
      }

      addCaption(path);

      function zoomIn(p) {
        if (p.depth > 1) p = p.parent;
        renderKeys(p.key, p.sum);
        if (!p.children) return;
        zoom(p, p);
      }

      function zoomOut(p) {
        if (!p || !p.parent) return;
        renderKeys(p.parent.key !== '' ? p.parent.key : '', p.parent.sum);
        
        zoom(p.parent, p);
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
              .each('end', render);
        });
      }
    
      d3.select('#refreshBtn').classed('hideOpac', true);
    },

    OnRefresh : function(context, callback) {
      d3.select('#refreshBtn').on("click", function(e) {
        var vals = d3.selectAll('.keys')[0];

        var a = [];
        for(var i=0; i<vals.length; i++)
          a.push(d3.select(vals[i]).data()[0][4]);

        callback.call(context, a);
      });
    }
  };

  return _public;

}();
