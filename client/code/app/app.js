'use strict';
/*global jQuery:true, ko:true, ss:true */

// Client Code

console.log('App Loading');

var model;

function defaultCallback(err, data) {
    if(err) console.log('ERROR: ' + err);
    else if(data) console.log(data);
}
  
ss.event.on('update', function(updates) {
  console.log('client received update ' + JSON.stringify(update));
  for (var i in updates) {
    var update = updates[i];
    console.log('client updating port ' + update.path + ' to value ' + update.value);
    
    findObj(model, update.path).last(update.value);
  }
});

function findObj(obj, objPath) {
  var start = obj;
	objPath = objPath.split('.');
	for(var i in objPath) {
		if(obj[objPath[i]]) {
			obj = obj[objPath[i]];
		}
	}
	if(obj !== start) {
		return obj;
	} else {
		return null;
	}
}

// we want to preserve the value of port at creation, so 
// we need to create the function inside another function with the 
// proper port as parameter
function makeComputedValue(objPath) {
  return ko.computed(
    function() { 
      var obj = findObj(model, objPath);
//      console.log(obj.path());
//      console.log(obj.name());
      return obj.last(); 
    }, 
    model);
}

function dependentRegister(objPath, reg) {
  // shallow copy
  reg = jQuery.extend({}, reg); 
  reg.last = makeComputedValue(objPath);
  return reg;
}

function recurseObject(object, objectFunction, path) {
  var properties = Object.getOwnPropertyNames(object);
	if(!path) {
		path = [];
	}
	for(var i in properties) {
		var propertyName = properties[i];
		var obj = object[propertyName];
		path.push(propertyName);
		if (obj !== null && typeof obj == 'object') {
			objectFunction(obj, path);
			recurseObject(obj, objectFunction, path);
		}
		path.pop();
	}
}

function comparator(left, right) {
  return left.id === right.id ? 0 : (left.id < right.id ? -1 : 1);
}

function iterateObject(object, fnc) {
  var properties = Object.getOwnPropertyNames(object);
	for(var i in properties) {
		var propertyName = properties[i];
		var obj = object[propertyName];
		fnc(obj, propertyName);
	}
}

function multiwrite(value, context) {
  var updates = [];
  iterateObject(context, function(register) {
    if(!register.path) return;
    if(register.last() === value) return;
    console.log('client writing %s value %s', register.path, value);    
    updates.push({path: register.path, value: value});
  });
  if(updates.length) {
    ss.rpc('lophilo.multiwrite', updates, defaultCallback);
  }
}

ss.rpc('lophilo.load', function(err, data) {
  console.log('loading data');
  console.dir(data);
  model = ko.mapping.fromJS(data);
  console.dir(model);
  model.pins = ko.observableArray();
  model.al = ko.observableArray();
  model.ah = ko.observableArray();
  model.aregs = ko.observableArray();
  
  model.pwms = ko.observableArray();
  model.bl = ko.observableArray();
  model.bh = ko.observableArray(); 
  
  model.powerstatus = ko.observable(false);
  
  recurseObject(data, function(register) {
    if(!register.id) {
      return;
    }
    if(register.rtype == 'IO') {
      var dpa = dependentRegister(register.path, register);
      model.pins.push(dpa);
      if(register.side == 'L') {
        model.al.push(dpa);
      } else {
        model.ah.push(dpa);
      }
    } else if(register.rtype == 'REGISTER') {
      if(register.shield == 'A') {
        console.log('register: ' + register.path);
        model.aregs.push(dependentRegister(register.path, register));  
      } else {
        var dpb = dependentRegister(register.path, register);
        model.pwms.push(dpb); 
        if(register.side == 'L') {
          model.bl.push(dpb);
        } else {
          model.bh.push(dpb);
        }        
      }
    }
  });
  
  model.al.sort(comparator);
  model.ah.sort(comparator);
  model.bl.sort(comparator);
  model.bh.sort(comparator);

  model.toggle = function(register) {
    var targetValue = register.last() === 0 ? 1 : 0;
    console.log('client writing %s from value %s to %d', register.path, register.last(), targetValue);
    ss.rpc('lophilo.write', register.path, targetValue, defaultCallback);
  };
  
  model.power = function() {    
    ss.rpc('lophilo.power', !model.powerstatus(), function() {
      console.log('power!');
      model.powerstatus(!model.powerstatus());
    });
  };
  
  model.allones = multiwrite.bind(null, 1);
  model.allzeros = multiwrite.bind(null, 0);
  ko.applyBindings(model);

});

console.log('App Loaded');