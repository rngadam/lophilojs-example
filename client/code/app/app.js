'use strict';
/*global jQuery:true, ko:true, ss:true */

// Client Code

console.log('App Loading');

var model;

function defaultCallback(err, data) {
    if(err) console.log('ERROR: ' + err);
    else if(data) console.log(data);
}
  
ss.event.on('update', function(update) {
  console.log('client received update ' + JSON.stringify(update));
  for (var port in update) {
    console.log('client updating port ' + port + ' to value ' + update[port]);
    model[port].value(update[port]);
  }
});

// we want to preserve the value of port at creation, so 
// we need to create the function inside another function with the 
// proper port as parameter
function makeComputedValue  (portname) {
  return ko.computed(
    function() { 
      return this[portname].value(); 
    }, 
    model);
}

function makeComputedLabel(portname) {
  return ko.computed( 
      function() {
        var prefix = this[portname].id() < 10 ? '0' : '';
        return this[portname].shield() + prefix + this[portname].id();
      }, 
      model);  
}

function dependentPort(portname, port) {
  // shallow copy
  port = jQuery.extend({}, port); 
  port.value = makeComputedValue(portname);
  port.label = makeComputedLabel(portname);
  return port;
}

ss.rpc('lophilo.load', function(err, data) {
  console.log('loading data');
  //console.dir(data);
  model = ko.mapping.fromJS(data);
  //console.dir(model);
  model.pins = ko.observableArray();
  model.al = ko.observableArray();
  model.ah = ko.observableArray();
  
  for(var portname in data) {
    var port = data[portname];
    if(port.type == 'IO') {
      model.pins.push(dependentPort(portname, port));
      if(port.side == 'L') {
        model.al.push(dependentPort(portname, port));
      } else {
        model.ah.push(dependentPort(portname, port));
      }
    }
  }
  model.toggle = function(port) {
    var targetValue = port.value() == 1 ? 0 : 1;
    console.log('client writing %s from value %s to %d', port.name, port.value(), targetValue);
    ss.rpc('lophilo.write', port.name, targetValue, defaultCallback);
  };

  ko.applyBindings(model);

});

console.log('App Loaded');