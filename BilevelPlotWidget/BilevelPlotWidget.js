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
  "esri/opsdashboard/DataSourceProxy",
  "esri/tasks/FeatureSet",
  "dijit/_WidgetBase", 
  "dijit/_TemplatedMixin",
  "esri/opsdashboard/WidgetProxy",
  "esri/tasks/query",
  "dojo/text!./BilevelPlotWidgetTemplate.html"
], function (declare, lang, 
  Deferred, Msg,
  DataSourceProxy, FeatureSet,
  _WidgetBase, _TemplatedMixin, WidgetProxy, Query, templateString) {

  return declare("BilevelPlotWidget", [_WidgetBase, _TemplatedMixin, WidgetProxy], {
    templateString: templateString,
    debugName: "TimeChartWidget",

    constructor: function() {
      document.QueryFieldNdx = [0, 1, 2, 3, 4];
      Date.prototype.addDays = function (n) {
        var time = this.getTime();
        var changedDate = new Date(time + (n * 24 * 60 * 60 * 1000));
        this.setTime(changedDate.getTime());
        return this;
      };

      ChildrenArray = Array;
      ChildrenArray.prototype.addValue = function(k, nid, id, v) {
        var valObj;
        this.some(function(f,i) {
          if(f.name == k[nid]) {
            valObj = f;
            return true;
          }
          return false;
        });

        if(valObj === undefined) {
          valObj = (v === undefined) 
            ? {name:k[nid], fids:[id], children: new ChildrenArray(), nid:nid} 
            : {name:k[nid], fids:[id], size:v, nid:nid};
          this.push(valObj);
        } else {
          valObj.fids.push(id);
          if(v !== undefined) {
            valObj.size += v;
          }
        }

        return valObj;
      };

    },

    postCreate: function () {
      this.inherited(arguments);
      Bilevel.Init(d3.select("body")[0][0].clientWidth);
    },

    hostReady: function(){

      Bilevel.OnRefresh(this, function(qNdx) {
        for(var i=0; i<qNdx.length; i++)
          document.QueryFieldNdx[i]=qNdx[i];
        
        this.PlotChart();
      });

      // Time Chart time Properties
      totalDays = document.getElementById("totalDays");
      period = document.getElementById("period");

      totalDays.addEventListener("input", lang.hitch(this, function(v) { 
          document.getElementById("totalDaysCount").innerHTML = totalDays.value;
        })
      );

      totalDays.addEventListener("change", lang.hitch(this, function(v) { 
          this.PlotChart();
        })
      );

      period.addEventListener("input", lang.hitch(this, function(v) { 
          document.getElementById("periodCount").innerHTML = period.value;
        })
      );

      period.addEventListener("change", lang.hitch(this, function(v) { 
          this.PlotChart();
        })
      );

      var expandBtn = document.getElementById("expandBtn");
      var TotalPeriod = document.getElementById("TotalPeriod");
      var TotalPeriod1 = document.getElementById("TotalPeriod1");

      expandBtn.addEventListener("keydown", function(e) {
        if(e.keyCode==9 && !e.shiftKey) {
          e.preventDefault();
          expandBtn.click();
          if(TotalPeriod.className === '') {
            document.getElementById('totalDays').focus();
          }
        }
      });
      
      expandBtn.addEventListener("click", function() {
        var expandBtn = document.getElementById("expandBtn");
        if(TotalPeriod.className=='hide') {
          TotalPeriod.className = '';
          TotalPeriod1.setAttribute('style','background-color: white;');
          expandBtn.children[0].setAttribute('src', 'collapse.png');
          expandBtn.setAttribute('title', 'collapse');
        } else {
          TotalPeriod.className='hide';
          TotalPeriod1.setAttribute('style','background-color: transparent;');
          expandBtn.children[0].setAttribute('src', 'expand.png');
          expandBtn.setAttribute('title', 'expand');
        }
      });
    },

    PlotContsByDates : function(dataSources) {
      var ageingRoot = {};
      
      // if(qNdx != undefined)
      // document.QueryFieldNdx = qNdx; 
    

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
              if(result.cancel===true) {
                throw {error:{code:"cancel", description:ds.id}};
              }
              return new FeatureSet(result.featureSet);
            }), 
            lang.hitch(this, function(err) {
              //this.isBroken = !0;
              throw err;
            })
          );
      };

      var exec = function(dfr) {
        var today = new Date();

        var query = new Query();
        query.outFields = ["objectid", "CreationDate", "Creator", "feedback_obstype", "feedback_status", "mgmt_data_source"];
        query.returnGeometry = true;

        var prevDates = {};
        var maxDays = parseInt(this.totalDays.value);
        var period = parseInt(this.period.value);
        
        var j;
        for(var i=1; i<=maxDays / period; i++) {
            j=i*period;
            var k = i==1 
            ? ("less than "+j+" days") 
            : (((i-1) * period)+1 + " to " + (i*period) + " days");
            prevDates[k]={ date: new Date().addDays(-j), count:0, features:[]};
        }
        prevDates["more than "+(j+1)+" days"]={ date: new Date().addDays(-10000), count:0, last:true, features:{}};
        
        var ageingRoot = {"name": "ageing", "children": new ChildrenArray()};
        var getSumCounts = function(dfr, dataSources) {

          if(dataSources && dataSources.length > 0) {

            var dataSource = dataSources.pop();
            executeQuery(dataSource, query).then(
              lang.hitch(this, function (featureSet) {
                //console.log(featureSet.features);

                featureSet.features.forEach(function(f){
                  var CreationDate = new Date(f.attributes.CreationDate);
                  var fid =f.attributes.objectid;
                  var BreakException = {};
                  
                  try {
                    for(var k in prevDates) {
                      if(prevDates[k].last || CreationDate > prevDates[k].date) {

                        if(!prevDates[k].features[dataSource.id] || prevDates[k].features[dataSource.id] === undefined)
                          prevDates[k].features[dataSource.id] = [];
                        
                        prevDates[k].features[dataSource.id].push(fid);
                        prevDates[k].count++;

                        var values = [
                          k, 
                          f.attributes.mgmt_data_source, 
                          f.attributes.Creator, 
                          document.TypeCVs.find(function(c) { return c.code==f.attributes.feedback_obstype; }).name,
                          document.StatusCVs.find(function(c) { return c.code==f.attributes.feedback_status; }).name
                        ];
                        ageingRoot
                          .children.addValue(values, document.QueryFieldNdx[0], fid)
                          .children.addValue(values, document.QueryFieldNdx[1], fid)
                          .children.addValue(values, document.QueryFieldNdx[2], fid)
                          .children.addValue(values, document.QueryFieldNdx[3], fid)
                          .children.addValue(values, document.QueryFieldNdx[4], fid, 1);

                        throw BreakException;
                      }
                    }
                  } catch (be) {
                    if (be !== BreakException) {
                      dfr.reject(be);
                      throw be;
                    }
                  }
                }
              );

              if(dataSources.length > 0) {
                return getSumCounts(dfr, dataSources);
              }
              else {
                dfr.resolve(prevDates);
              }

              }),
              function(err) { 
                console.log('executeQuery', err.error.code + ": " + err.error.description, err);
              }
            );
          }

          return dfr;
        };

        getSumCounts(new Deferred(), dataSources).then(function() {
           dfr.resolve({prevDates:prevDates, ageingRoot:ageingRoot});
        });

        return dfr;
      };

      exec(new Deferred()).then(
        function(results) {

          //console.log(results,JSON.stringify(results.ageingRoot));
          // return;

          Bilevel.Plot(results.ageingRoot);
        },
        function(error) {
          console.error('exec', error);
        }
      );
    },

    PlotChart: function( qNdx) {
      Bilevel.Init(d3.select("body")[0][0].clientWidth);
      this.getDataSourceProxies().then( lang.hitch(this, function(dataSources) {
        document.StatusCVs = dataSources[0].fields.find(function (f) { return f.name == "feedback_status"; }).domain.codedValues;
        document.TypeCVs = dataSources[0].fields.find(function (f) { return f.name == "feedback_obstype"; }).domain.codedValues;

        this.PlotContsByDates(dataSources.filter(function(ds) {return ds.name.indexOf('Selection') < 0; }), qNdx);
      }));
    },

    dataSourceExpired: function (dataSourceProxy, dataSourceConfig) {
      this.PlotChart();
    },

  });
 });