define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/store/Memory",
  "dojo/ready",
  "dojo/Deferred",
  "esri/opsdashboard/core/messageHandler",
  "esri/opsdashboard/core/errorMessages",
  //"esri/opsdashboard/DataSourceProxy",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "esri/opsdashboard/WidgetConfigurationProxy",
  "dojo/text!./TimeChartWidgetConfigTemplate.html",
  "dojox/form/CheckedMultiSelect"
], function (declare, lang, Memory, 
  ready, Deferred, Msg, ErrorMessages, //DataSourceProxy,
  _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
  WidgetConfigurationProxy, templateString) {

    return declare("TimeChartWidgetConfig", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
      WidgetConfigurationProxy], {
      templateString: templateString,

    hostReady: function(){
      this.getDataSourceProxies().then(
          function(dataSources) { console.log(dataSources); },
          function(err) { console.log('error: '+err); }
      );
      // var dsList = document.getElementById("dsList");
      // results.data.forEach(function(ds) {
      //   var li = document.createElement("li");
      //   li.appendChild(document.createTextNode(ds.name));
      //   li.setAttribute("id", ds.dataSourceId);
      //   dsList.appendChild(li);      
      // })
    },

    getDataSourceProxies: function() {
        return !this._isHostInitialized() 
        ? (new Deferred).reject(Error(ErrorMessages.hostNotReady)) 
        : Msg._sendMessageWithReply({functionName: "getDataSources"}).then(lang.hitch(this, function(a) {
            return (new Deferred).resolve(a.dataSources);
        }))
    },

    postCreate: function () {
      this.inherited(arguments);
      this.dataSources = new Memory({});

      
      
      document.getElementById("addDataSourceBtn").addEventListener("click", lang.hitch(this, function(){
        var dsList = document.getElementById("dsList");
        var lis = dsList.getElementsByTagName('li');
        if(lis.length<3) {
          var liId = this.dataSourceConfig.dataSourceId;
          if(!document.getElementById(liId)) {
            var li = document.createElement("li");
            li.appendChild(document.createTextNode(this.dataSource.name));
            li.setAttribute("id", liId);
            dsList.appendChild(li);
            this.dataSources.put({id:this.dataSources.data.length, name:this.dataSource.name, dataSource:this.dataSource})
            if(this.dataSources.data.length == 3) {
              //console.log(this.dataSources);
              // make it persistent
              // storageProvider.put("TimeChartDataSources", this.dataSources, function(status, keyName){
              //   console.log(status+" value put in "+keyName);
              // });

              this.config.propertyIWantoSave = "TimeChartDataSources";
              this.dataSourceConfig.xField = this.dataSources;
              this.readyToPersistConfig(true);
            }
          }
        }
      }));

      document.getElementById("clearDataSourceBtn").addEventListener("click", lang.hitch(this, function(){
        var dsList =document.getElementById("dsList");
        dsList.innerHTML = null;
        this.dataSources = new Memory({});
        this.readyToPersistConfig(false);
      }));
    },

    dataSourceSelectionChanged: function (dataSource, dataSourceConfig) {

      this.dataSource = dataSource;
      this.dataSourceConfig = dataSourceConfig;

      // this.getDataSourceProxies().then(
      //     function(r) { console.log(r); },
      //     function(r) { console.log('error: '+r); }
      // ),

         
      // var alphaNumericFields = [];
      // dataSource.fields.forEach(function (field) {
      //   switch (field.type) {
      //     case "esriFieldTypeString":
      //     case "esriFieldTypeSmallInteger":
      //     case "esriFieldTypeInteger":
      //     case "esriFieldTypeSingle":
      //     case "esriFieldTypeDouble":
      //       alphaNumericFields.push(field);
      //       return;
      //   }
      // });

      // var alphaNumericFieldsStore = new Memory({
      //   idProperty: "name",
      //   data: alphaNumericFields
      // });

      // //this.multiSelectDiv.set("store", alphaNumericFieldsStore);

      // // // Set previous fields saved in config
      // // if (Array.isArray(dataSourceConfig.selectedFieldsNames))
      // //   this.multiSelectDiv.set("value", dataSourceConfig.selectedFieldsNames);
    },

    // // multiSelectDiv.
    onSelectionChanged: function (value) {

      // if (!this.dataSourceConfig)
      //   return;

      // this.dataSourceConfig.selectedFieldsNames = value;
      // this.readyToPersistConfig(Array.isArray(value) && value.length > 0);
    }
  });
});