/**
 * COPYRIGHT 2015 ESRI
 *
 * TRADE SECRETS: ESRI PROPRIETARY AND CONFIDENTIAL
 * Unpublished material - all rights reserved under the
 * Copyright Laws of the United States and applicable international
 * laws, treaties, and conventions.
 */
define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/Deferred",
  "esri/opsdashboard/core/messageHandler",
  "esri/opsdashboard/core/errorMessages",
  "esri/opsdashboard/DataSourceProxy",
  "esri/tasks/FeatureSet",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "esri/opsdashboard/WidgetProxy",
  "esri/tasks/query",
  "dojo/text!./BilevelPlotWidgetTemplate.html"
], function (declare, lang, 
  Deferred, Msg, ErrorMessages, 
  DataSourceProxy, FeatureSet,
  _WidgetBase, _TemplatedMixin, WidgetProxy, Query, templateString) {

  return declare("BilevelPlotWidget", [_WidgetBase, _TemplatedMixin, WidgetProxy], {
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

    constructor: function() {
      Date.prototype.addDays = function (n) {
        var time = this.getTime();
        var changedDate = new Date(time + (n * 24 * 60 * 60 * 1000));
        this.setTime(changedDate.getTime());
        return this;
      }
    },

    postCreate: function () {
      this.inherited(arguments);

      Bilevel.Init("flare.json", d3.select("body")[0][0].clientWidth);
    },

    hostReady: function(){

      // Time Chart time Properties
      totalDays = document.getElementById("totalDays");
      period = document.getElementById("period");

      totalDays.addEventListener("input", lang.hitch(this, function(v) { 
          document.getElementById("totalDaysCount").innerHTML = totalDays.value;
        })
      );
      totalDays.addEventListener("change", lang.hitch(this, function(v) { 
          this.getDataSourceProxies().then( this.getContsByDates );
        })
      );
      period.addEventListener("input", lang.hitch(this, function(v) { 
          document.getElementById("periodCount").innerHTML = period.value;
        })
      );
      period.addEventListener("change", lang.hitch(this, function(v) { 
          this.getDataSourceProxies().then( this.getContsByDates );
        })
      );

      var expandBtn = document.getElementById("expandBtn");
      var TotalPeriod = document.getElementById("TotalPeriod");
      expandBtn.addEventListener("keydown", function(e) {
        if(e.keyCode==9 && !e.shiftKey) {
          e.preventDefault();
          expandBtn.click();
          if(TotalPeriod.className=='') {
            document.getElementById('totalDays').focus();
          }
        }
      });
      
      expandBtn.addEventListener("click", function() {
        var expandBtn = document.getElementById("expandBtn");
        if(TotalPeriod.className=='hide') {
          TotalPeriod.className = '';
          expandBtn.children[0].setAttribute('src', 'collapse.png');
          expandBtn.setAttribute('title', 'collapse');
        } else {
          TotalPeriod.className='hide';
          expandBtn.children[0].setAttribute('src', 'expand.png');
          expandBtn.setAttribute('title', 'expand');
        }
      });

      // // Query the features and update the chart
      // var dataSourceProxy = this.dataSourceProxies[0];
      // var dataSourceConfig = this.getDataSourceConfig(dataSourceProxy);
      // this.query = new Query();
      // this.query.outFields = [dataSourceProxy.objectIdFieldName, dataSourceConfig.idField, dataSourceConfig.xField, dataSourceConfig.yField];
      // this.query.returnGeometry = false;

    },

    ageingRoot : {},

    getContsByDates : function(dataSources) {
      document.dataSources = dataSources.filter(function(ds) {return ds.name.indexOf('Selection') < 0});
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
        query.outFields = ["objectid", "CreationDate", "Creator", "feedback_obstype", "feedback_status", "mgmt_data_source"];
        query.returnGeometry = false;

        var prevDates = {};
        var maxDays = parseInt(this.totalDays.value);
        var period = parseInt(this.period.value);

        for(var i=1; i<=maxDays / period; i++) {
            var j=i*period;
            var k = i==1 
            ? ("less than "+j+" days") 
            : (((i-1) * period)+1 + " to " + (i*period) + " days");
            prevDates[k]={ date: new Date().addDays(-j), count:0, features:[]};
        }
        prevDates["more than "+(j+1)+" days"]={ date: new Date().addDays(-10000), count:0, last:true, features:[]};
        
        var getSumCounts = function(dfr, dataSources) {
          if(dataSources && dataSources.length > 0) {
            ageingRoot = {"name": "ageing", "children": []};
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

                                var periods = ageingRoot["children"];

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

          // console.log(prevDates);

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
              li.setAttribute('tabindex', 0);
              var m = document.createElement('div');
              m.style['background-color']='black';//colors[c];

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
                color: 'black',// colors[c],
                "data-ids" : prevDates[key].features
              });
              //c = (c+1) % colors.length;
            }
          };
          chart.addSeries("Incidents", dsnArr);
          chart.render();
          document.getElementById('LegendDiv').style["min-height"] = Math.max(
            document.getElementById('countList').offsetHeight,
            document.getElementById('TotalPeriod1').offsetHeight
            )+'px';
      })
    },

    dataSourceExpired: function (dataSourceProxy, dataSourceConfig) {


    },

  });
 });