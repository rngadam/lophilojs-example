'use strict';
/*global ko:true, ss:true */

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
    model[port](update[port]);
  }
});

// we want to preserve the value of port at creation, so 
// we need to create the function inside another function with the 
// proper port as parameter
function makeComputed(port) {
    return ko.computed(
      function() { return this[port](); }, 
      model)
}

ss.rpc('lophilo.load', function(err, data) {
  console.log('loading data');
  model = ko.mapping.fromJS(data);
  model.pins = ko.observableArray();
  for(var port in data) {
    model.pins.push({
      port: port,
      value: makeComputed(port)
    });
  }
  model.toggle = function(pin) {
    var targetValue = pin.value() == 1 ? 0 : 1;
    console.log('client writing %s from value %s to %d', pin.port, pin.value(), targetValue);
    ss.rpc('lophilo.write', pin.port, targetValue, defaultCallback);
  };

  ko.applyBindings(model);

});

console.log('App Loaded');