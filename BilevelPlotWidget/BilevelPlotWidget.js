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
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "esri/opsdashboard/WidgetProxy",
  "esri/tasks/query",
  "dojo/text!./BilevelPlotWidgetTemplate.html"
], function (declare, lang, _WidgetBase, _TemplatedMixin, WidgetProxy, Query, templateString) {

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

    postCreate: function () {
      this.inherited(arguments);

      Bilevel.init("flare.json", d3.select("body")[0][0].clientWidth);

    },

    constructor: function() {
      Date.prototype.addDays = function (n) {
        var time = this.getTime();
        var changedDate = new Date(time + (n * 24 * 60 * 60 * 1000));
        this.setTime(changedDate.getTime());
        return this;
      }
    },

    hostReady: function(){

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

    dataSourceExpired: function (dataSourceProxy, dataSourceConfig) {


    },

  });
 });