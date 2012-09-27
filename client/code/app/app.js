"use strict";

// Client Code

console.log('App Loaded');

var InputOutputModel = function() {
    this.pins = ko.observableArray();
};

var model = new InputOutputModel();

function refreshInputOutput() {
    ss.rpc('lophilo.readShieldA', function(values) {
        model.apps.pins(values);
    });    
}