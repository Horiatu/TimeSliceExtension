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
  ready, Deferred, Msg, ErrorMessages, 
  //DataSourceProxy,
  _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
  WidgetConfigurationProxy, templateString) {

    return declare("TimeChartWidgetConfig", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
      WidgetConfigurationProxy], {
      templateString: templateString,

    hostReady: function(){
      this.getDataSourceProxies().then(
          lang.hitch(this, function(dataSources) { 
              console.log(dataSources); 
              this.dataSources = dataSources;
              dataSourceIds = [];

              var cbClick = function(e) {
                var cb = e.currentTarget;
                var id = cb.id;
                if(cb.checked) {
                  dataSourceIds.push(id);
                }
                else {
                  var i = dataSourceIds.indexOf(id);
                  if(i > -1) {
                    dataSourceIds.splice(i,1);
                  }
                }

                Msg._sendMessage({functionName:"readyToPersistConfig", args:{canAccept:dataSourceIds.length == 3}});
              };

              var dataSourcesDiv = document.getElementById("dataSources");
              this.dataSources.forEach(function (ds) {
                  var cbId = ds.id;
                  var cb = document.createElement("input");
                  cb.setAttribute("type", 'checkbox');
                  cb.setAttribute("id", cbId);

                  cb.addEventListener("click", lang.hitch(this, cbClick));
                  
                  var lb = document.createElement('label');
                  lb.setAttribute('for', cbId);
                  lb.appendChild(document.createTextNode(ds.name));

                  dataSourcesDiv.appendChild(cb);
                  dataSourcesDiv.appendChild(lb);
                  dataSourcesDiv.appendChild(document.createElement('br'));
              });


              // get persistent ids and populate cbs


              

          }),
          function(err) { console.log('error: '+err); }
      );
    },

    getDataSourceProxies: function() {
        return !this._isHostInitialized() 
        ? (new Deferred).reject(Error(ErrorMessages.hostNotReady)) 
        : Msg._sendMessageWithReply({functionName: "getDataSources"}).then(lang.hitch(this, function(a) {
            return (new Deferred).resolve(a.dataSources);
            // this._dataSourceProxies = {};
            // return a.dataSources.map(function(a) {
            //     return this._dataSourceProxies[a.id] = new DataSourceProxy(a);
            // }, this)
        }))
    },

    postCreate: function () {
      this.inherited(arguments);
      //this.dataSources = new Memory({});
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
    onDataSourcesSelectionChanged: function (value) {

      // if (!this.dataSources)
      //   return;

      // this.dataSourcesConfig.selectedFieldsNames = value;
      // this.readyToPersistConfig(Array.isArray(value) && value.length == 3);
    }
  });
});