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
      Date.prototype.addDays = function (n) {
        var time = this.getTime();
        var changedDate = new Date(time + (n * 24 * 60 * 60 * 1000));
        this.setTime(changedDate.getTime());
        return this;
      }

      Array.prototype.addValue = function(k, v) {
        var dfr = new Deferred();

        var valObj = this.find(function (f) { return(f.name==k);});

        if(valObj == undefined) {
          valObj = (v == undefined) ? {name:k, children:[]} : {name:k, size:v};
          this.push(valObj);
        } else {
          if(v != undefined) {
            valObj["size"] += v;
          }
        }
        dfr.resolve(valObj);
        return dfr;
      }
    },

    postCreate: function () {
      this.inherited(arguments);
      Bilevel.Clear(d3.select("body")[0][0].clientWidth);
      //Bilevel.Init("ageing1.json", d3.select("body")[0][0].clientWidth);
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
          this.getDataSourceProxies().then( 
            //this.getContsByDates 
            lang.hitch(this, function(ds) {
              this.getContsByDates(ds)
            })
            );
        })
      );
      period.addEventListener("input", lang.hitch(this, function(v) { 
          document.getElementById("periodCount").innerHTML = period.value;
        })
      );
      period.addEventListener("change", lang.hitch(this, function(v) { 
          this.getDataSourceProxies().then( 
            // this.getContsByDates 
            lang.hitch(this, function(ds) {
              this.getContsByDates(ds)
            })
            );
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
    },

    ageingRoot : {},

    getContsByDates : function(dataSources) {
      dataSources = dataSources.filter(function(ds) {return ds.name.indexOf('Selection') < 0});

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

                                ageingRoot.children.addValue(k).then(function (r){
                                  r.children.addValue(f.attributes.mgmt_data_source).then(function (r){
                                    r.children.addValue(f.attributes.Creator).then(function (r){
                                      r.children.addValue('Type '+f.attributes['feedback_obstype']).then(function (r){
                                        r.children.addValue("Status "+f.attributes['feedback_status'], 10).then(
                                          function (r){
                                            //console.log(ageingRoot, r);
                                            throw BreakException;
                                          },
                                          function (err){
                                            console.log('ageingRoot', err);
                                          }
                                        )
                                      })
                                    });
                                  });
                                });

                            }
                        }
                    } catch(e) {
                      if (e!==BreakException) {
                        throw e;
                      }
                      else {
                        console.error(e);
                      }
                    }
                })
              }),
              function(err) { 
                console.log(err.error.code + ": " + err.error.description, err);
              }
            ).always(function() {
              if(dataSources.length > 0) {
                return getSumCounts(dfr, dataSources);
              }
              else {
                dfr.resolve(prevDates);
              }
            });
          }

          return dfr;
        };

        getSumCounts(new Deferred, dataSources).then(function() {
          dfr.resolve({prevDates:prevDates, ageingRoot:ageingRoot});
        });
        return dfr;
      };

      exec(new Deferred).then(
        function(results) {

          //console.log(results,JSON.stringify(results.ageingRoot));
          // return;

          //var root = JSON.parse(JSON.stringify(results.ageingRoot));

          //Bilevel.Clear();
          Bilevel.Plot(results.ageingRoot);

        },
        function(error) {
          console.error('exec', error)
        }
      )
    },

    dataSourceExpired: function (dataSourceProxy, dataSourceConfig) {
      Bilevel.Clear(d3.select("body")[0][0].clientWidth);
      this.getDataSourceProxies().then( lang.hitch(this, function(ds) {this.getContsByDates(ds)}))
    },

  });
 });