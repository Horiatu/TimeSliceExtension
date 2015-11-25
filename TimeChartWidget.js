define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/Deferred",
  "esri/opsdashboard/core/messageHandler",
  "esri/opsdashboard/core/errorMessages",
  "esri/opsdashboard/DataSourceProxy",
  "esri/tasks/FeatureSet",
  "dojox/charting/Chart2D",
  "dojox/charting/plot2d/Pie",
  "dojox/charting/action2d/Highlight",
  "dojox/charting/action2d/MoveSlice",
  "dojox/charting/action2d/Tooltip",
  "dojox/charting/themes/CubanShirts",
  //"dojo/store/Observable", "dojo/store/Memory",
  //"dojox/charting/themes/Claro",
  //"dojox/charting/widget/SelectableLegend",
  //"dojox/charting/widget/Legend",  
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "esri/opsdashboard/WidgetProxy",
  "dojo/store/Memory",
  "dojo/store/Observable",
  "esri/tasks/query",
  "dgrid/OnDemandGrid",
  "dojo/text!./TimeChartWidgetTemplate.html"
], function (declare, lang, 
  Deferred, Msg, ErrorMessages, 
  DataSourceProxy, FeatureSet,
  Chart2D, Pie, Highlight, MoveSlice, 
  Tooltip, CubanShirts, 
  //ObservableStore, MemoryStore,
  //Claro, SelectableLegend, Legend,
  _WidgetBase, _TemplatedMixin, WidgetProxy, Memory, Observable, Query, Grid, templateString) {

  return declare("TimeChartWidget", [_WidgetBase, _TemplatedMixin, WidgetProxy], {
    templateString: templateString,
    debugName: "TimeChartWidget",

    getDataSourceProxies: function() {
        return !this._isHostInitialized() 
        ? (new Deferred).reject(Error(ErrorMessages.hostNotReady)) 
        : Msg._sendMessageWithReply({functionName: "getDataSources"}).then(lang.hitch(this, function(a) {
            //return (new Deferred).resolve(a.dataSources);
            this._dataSourceProxies = {};
            return a.dataSources.map(function(a) {
                return this._dataSourceProxies[a.id] = new DataSourceProxy(a);
            }, this)
        }))
    },

    hostReady: function () {
      Date.prototype.addDays = function (n) {
        var time = this.getTime();
        var changedDate = new Date(time + (n * 24 * 60 * 60 * 1000));
        this.setTime(changedDate.getTime());
        return this;
      };
      
      dsnArr=[];

      // var store = new ObservableStore(new MemoryStore({
      //   data: {
      //     items: dsnArr
      //   }
      // }));


      colors= ["#a08bdd", "#c7b85e", "#af95ff", "#67a966", "#99c044"];
      chart = new dojox.charting.Chart2D("reportChartDiv");
      chart.addPlot("default", {
          type: "Pie",
          //radius: 90,
          labelOffset: 30,
          shadow:false,
          stroke:"aliceblue",
          //labelWiring: "darkgray",
          //labelStyle: "columns"
      }).setTheme(dojox.charting.themes.CubanShirts);

      chart.connectToPlot("default", function(evt) {
        if(evt.type != 'onclick') return;
        // Use console to output information about the event
        console.info("Chart event on default plot!", evt);
        console.info(evt.run.data[evt.index]["data-ids"]);
        // console.info("Event type is: ",evt.type); // onclick
        // console.info("The element clicked was: ",evt.element); // slice
        });

      var a1 = new dojox.charting.action2d.Tooltip(chart, "default");
      var a = new dojox.charting.action2d.MoveSlice(chart, "default", {
          duration: 500,
          scale: 1.1,
          shift: 10
      });

      var a2 = new dojox.charting.action2d.Highlight(chart, "default");

      // chart.addSeries("Incidents", new StoreSeries(store));
      // chart.render();

      // var selectableLegend = new dojox.charting.widget.SelectableLegend({
      //     chart: chart,
      //     outline: false,
      //     horizontal: true
      // }, "reportChartLegendDiv");

    },

    getContsByDates : function(dataSources) {
      dataSources = dataSources.filter(function(ds) {return ds.name.indexOf('Selection') < 0});
      //console.log(dataSources);
      
      //this.document.getElementById('countList').innerHTML = '';

      var executeQuery = function(ds, query) {
        return Msg._sendMessageWithReply({
          functionName: "executeQuery",
          args: {
            dataSourceId: ds.id,
            query: query
          }
          }).then(
            lang.hitch(this, function(result) {
              //this.isBroken = !1;
              if(result.cancel==true) {
                throw {error:{code:"cancel", description:ds.id}};
              }
              return new FeatureSet(result.featureSet)
            }), 
            lang.hitch(this, function(err) {
              //this.isBroken = !0;
              throw err;
            })
          )
      };

      var exec = function(dfr) {
        var today=new Date();

        var query = new Query();
        query.outFields = ["objectid", "CreationDate"];
        query.returnGeometry = false;

        var prevDates = {};
        var maxDays = 50;
        var period = 10;

        for(var i=1; i<=maxDays / period; i++) {
            var j=i*period;
            var k = i==1 
            ? ("less than "+j+" days") 
            : (((i-1) * period)+1 + " to " + (i*period) + " days");
            prevDates[k]={ date: new Date().addDays(-j), count:0, features:[]};
        }
        prevDates["more than "+(maxDays+1)+" days"]={ date: new Date().addDays(-10000), count:0, last:true, features:[]};
        
        var getSumCounts = function(dfr, dataSources) {
          if(dataSources && dataSources.length > 0) {
            executeQuery(dataSources.pop(), query).then(
              lang.hitch(this, function (featureSet) {
                //console.log(featureSet.features);

                featureSet.features.forEach(function(f){
                    var CreationDate = new Date(f.attributes.CreationDate);
                    var BreakException = {};
                    try {
                        for(var k in prevDates) {
                            if(prevDates[k].last || CreationDate > prevDates[k].date) {
                                prevDates[k].features.push(f.attributes.objectid);
                                prevDates[k].count++;
                                throw BreakException;
                            }
                        }
                    } catch(e) {
                        if (e!==BreakException) throw e;
                    }
                })
              }),
              function(err) { 
                console.log(err.error.code + ": " + err.error.description);
              }
            ).always(function() {
              if(dataSources.length > 0) {
                getSumCounts(dfr, dataSources);
              }
              else {
                dfr.resolve(prevDates);
              }
            });
          }

          return dfr;
        };

        getSumCounts(new Deferred, dataSources).then(function() {
          dfr.resolve(prevDates);
        });
        return dfr;
      };

      exec(new Deferred).then(function(prevDates) {

          console.log(prevDates);

          var countList = this.document.getElementById('countList');
          countList.innerHTML = '';

          //var 
          dsnArr=[];
          
          var c = 0;

          var total = 0;
          for(var cnt in prevDates) {
            total += prevDates[cnt].count;
          }

          var liTotal = this.document.createElement('li');
          liTotal.className = 'legend title';
          liTotal.appendChild(document.createTextNode('Selected Incidents: '+total));
          countList.appendChild(liTotal);

          for(var key in prevDates) {
            var countsStr = key;
            
            if(prevDates[key].count>0){
              var li = this.document.createElement('li');
              li.className = 'legend';
              var m = document.createElement('div');
              m.style['background-color']=colors[c];

              li.appendChild(m);
              li.appendChild(document.createTextNode(countsStr+"  -  "));

              var countNode = document.createElement('div');
              countNode.className = 'title';
              countNode.appendChild(document.createTextNode(prevDates[key].count));
              li.appendChild(countNode);
              countList.appendChild(li);

              dsnArr.push({
                y: prevDates[key].count,
                text: (prevDates[key].count/total*100).toFixed(1)+"%",
                tooltip: countsStr +" : "+prevDates[key].count,
                fontSize: 14,
                fontColor: 'black',
                color: colors[c],
                "data-ids" : prevDates[key].features
              });
              c = (c+1) % colors.length;
            }
          };
          chart.addSeries("Incidents", dsnArr);
          chart.render();
      })
    },

    dataSourceExpired: function (dataSource, dataSourceConfig) {
      this.getDataSourceProxies().then( this.getContsByDates );
    },
  });
});
