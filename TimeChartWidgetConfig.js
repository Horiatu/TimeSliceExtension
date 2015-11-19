define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/store/Memory",
  "dojox/storage",
  "dojo/ready",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "esri/opsdashboard/WidgetConfigurationProxy",
  "dojo/text!./TimeChartWidgetConfigTemplate.html",
  "dojox/form/CheckedMultiSelect"
], function (declare, lang, Memory, 
  Storage, ready,
  _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
  WidgetConfigurationProxy, templateString) {

    ready(function(){
      dojox.storage.manager.initialize();
      this.storageProvider = dojox.storage.manager.getProvider();
      this.storageProvider.initialize();
      var results = this.storageProvider.get("TimeChartDataSources");
      console.log(results);

      var dsList = document.getElementById("dsList");
      results.data.forEach(function(ds) {
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(ds.name));
        li.setAttribute("id", ds.dataSourceId);
        dsList.appendChild(li);      
      })
    });

    return declare("TimeChartWidgetConfig", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
      WidgetConfigurationProxy], {
      templateString: templateString,

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
              storageProvider.put("TimeChartDataSources", this.dataSources, function(status, keyName){
                console.log(status+" value put in "+keyName);
              });
            }
          }
        }
      }));

      document.getElementById("clearDataSourceBtn").addEventListener("click", lang.hitch(this, function(){
        var dsList =document.getElementById("dsList");
        dsList.innerHTML = null;
        this.dataSources = new Memory({});
      }));
    },

    dataSourceSelectionChanged: function (dataSource, dataSourceConfig) {

      this.dataSource = dataSource;
      this.dataSourceConfig = dataSourceConfig;


         
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
    // onSelectionChanged: function (value) {
    //   if (!this.dataSourceConfig)
    //     return;

    //   this.dataSourceConfig.selectedFieldsNames = value;
    //   this.readyToPersistConfig(Array.isArray(value) && value.length > 0);
    // }
  });
});