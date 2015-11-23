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
  "dojo/store/Memory",
  "dojo/store/Observable",
  "esri/tasks/query",
  "dgrid/OnDemandGrid",
  "dojo/text!./TimeChartWidgetTemplate.html"
], function (declare, lang, 
  Deferred, Msg, ErrorMessages, 
  DataSourceProxy, FeatureSet,
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
      
      // this.getDataSourceProxies().then( this.getContsByDates );

      // // Create the store we will use to display the features in the grid
      // this.store = new Observable(new Memory());

      // // Get from the data source and the associated data source config
      // // The dataSourceConfig stores the fields selected by the operation view publisher during configuration
      // var dataSource = this.dataSourceProxies[0];
      // var dataSourceConfig = this.getDataSourceConfig(dataSource);

      // // Build a collection of fields that we can display
      // var fieldsToQuery = [];
      // var columns = [];
      // dataSource.fields.forEach(function (field) {
      //   switch (field.type) {
      //     case "esriFieldTypeString":
      //     case "esriFieldTypeSmallInteger":
      //     case "esriFieldTypeInteger":
      //     case "esriFieldTypeSingle":
      //     case "esriFieldTypeDouble":
      //       fieldsToQuery.push(field.name);
      //       columns.push({field: field.name});
      //       return;
      //   }
      // });

      // // Create the grid
      // this.grid = new Grid({
      //   store: this.store,
      //   cleanEmptyObservers: false,
      //   columns: columns
      // }, this.gridDiv);

      // this.grid.startup();

      // Create the query object
      //fieldsToQuery.push(dataSource.objectIdFieldName);
      this.query = new Query();
      this.query.outFields = "*";
      this.query.returnGeometry = false;
      //console.log(this.query);
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
        for(var i=1; i<=4; i++) {
            var j=i*30;
            prevDates[j]={ date: new Date().addDays(-j), count:0, features:[]};
        }
        
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
                            if(CreationDate > prevDates[k].date) {
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
          var last = "0";
          for(var cnt in prevDates) {
            var countsStr = last + " to " + cnt + ": " 
            //+ prevDates[cnt].date+ "   " 
            + prevDates[cnt].count;
            last = cnt;

            var li = this.document.createElement('li');
            li.appendChild(document.createTextNode(countsStr));
            countList.appendChild(li);
            //console.log(countsStr);
          };
      })
    },

    dataSourceExpired: function (dataSource, dataSourceConfig) {
      //alert(0);
      //console.log(dataSource.name);
      
      this.getDataSourceProxies().then( this.getContsByDates );
      // // Execute the query. A request will be sent to the server to query for the features.
      // // The results are in the featureSet
      // this.DataSources.forEach(function(ds) {
      //   console.log(ds.name)
      //   //dataSource
      //   ds.executeQuery(this.query).then(lang.hitch(this, function (featureSet) {

      //     // Show the name of the data source and the number of features returned from the query
      //     this.updateDataSourceInfoLabel(ds.name, featureSet);

      //     //// Show the features in the table
      //     //this.updateAttributeTable(featureSet, ds);
      //   }))
      // });
    },

    // updateDataSourceInfoLabel: function (dataSourceName, featureSet) {

    //   // Compose the correct string to display
    //   var dataSourceInfo = dataSourceName;
    //   var featureCount = featureSet.features.length;
    //   if (featureCount === 0)
    //     dataSourceInfo += " has no feature";
    //   else
    //     dataSourceInfo += " has " + featureCount + " features";
    //   console.log(dataSourceInfo);

    //   this.infoLabel.innerHTML = dataSourceInfo;
    // },

    // updateAttributeTable: function (featureSet, dataSource) {
    //   // For each feature put them in the store and overwrite any existing
    //   // Potential improvement: Remove from the store the features that were not part of this update.
    //   featureSet.features.forEach(lang.hitch(this, function (feature) {
    //     this.store.put(feature.attributes, {overwrite: true, id: feature.attributes[dataSource.objectIdFieldName]});
    //   }));
    // }
  });
});
