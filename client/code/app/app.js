'use strict';
/*global ko:true, ss:true */

// Client Code

console.log('App Loaded');

var InputOutputModel = function() {
    this.pins = ko.observableArray();
};

var model = new InputOutputModel();

function refreshInputOutput() { 
    ss.rpc('lophilo.readShieldA', function(values) {
        model.pins(values);
    });
}

exports.toggle = function(pin) {
    ss.rpc('lophilo.write', pin.name, pin.bit == 1 ? 0 : 1);
};

ko.applyBindings(model);

setInterval(refreshInputOutput, 1000);
