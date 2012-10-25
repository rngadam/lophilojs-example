'use strict';
/*global jQuery:true, ko:true, ss:true */

// Client Code

console.log('App Loading');

function LophiloModel(data) {
  var self = this;
  
  // we want to preserve the value of port at creation, so 
  // we need to create the function inside another function with the 
  // proper port as parameter
  function makeComputedValue(objPath) {
    return ko.computed(
      function() { 
        var obj = findObj(self, objPath);
        return obj.last(); 
      }, 
      self);
  }
  
  function dependentRegister(objPath, reg) {
    // shallow copy
    reg = jQuery.extend({}, reg); 
    reg.last = makeComputedValue(objPath);
    return reg;
  }
  
  console.log('loading data');
  console.dir(data);
  ko.mapping.fromJS(data, {}, self);
  console.dir(self);
  self.pins = ko.observableArray();
  self.al = ko.observableArray();
  self.ah = ko.observableArray();
  self.aregs = ko.observableArray();
  
  self.pwms = ko.observableArray();
  self.bl = ko.observableArray();
  self.bh = ko.observableArray(); 
  
  recurseObject(data, function(register) {
    
    if(!register.id) {
      return;
    }
    if(register.rtype == 'IO') {
      var dpa = dependentRegister(register.path, register);
      self.pins.push(dpa);
      if(register.side == 'L') {
        self.al.push(dpa);
      } else {
        self.ah.push(dpa);
      }
    } else if(register.rtype == 'REGISTER') {
      if(register.shield == 'A') {
        console.log('register: ' + register.path);
        self.aregs.push(dependentRegister(register.path, register));  
      } else {
        var dpb = dependentRegister(register.path, register);
        self.pwms.push(dpb); 
        if(register.side == 'L') {
          self.bl.push(dpb);
        } else {
          self.bh.push(dpb);
        }        
      }
    }
  });
  
  self.al.sort(comparator);
  self.ah.sort(comparator);
  self.bl.sort(comparator);
  self.bh.sort(comparator);

  self.toggle = function(register) {
    var targetValue = register.last() === 0 ? 1 : 0;
    console.log('client writing %s from value %s to %d', register.path, register.last(), targetValue);
    ss.rpc('lophilo.write', register.path, targetValue, defaultCallback);
  };
  self.powerstatus = ko.computed({
    read: function() {
      return self.power.last() === self.SHIELDS_POWER_ON();
    },
    write: function(value) {
      ss.rpc('lophilo.power', !self.power.last(), defaultCallback);
    }
  }, self);  
  self.allones = multiwrite.bind(null, 1);
  self.allzeros = multiwrite.bind(null, 0);
}

var model;

ss.rpc('lophilo.load', function(err, data) {
  model = new LophiloModel(data);
  ko.applyBindings(model);
});

function defaultCallback(err, data) {
    if(err) console.log('ERROR: ' + err);
    else if(data) console.log(data);
}
  
ss.event.on('update', function(updates) {
  console.log('client received update ' + JSON.stringify(updates));
  if(!model) {
   console.log('event received before model created!');
  }
  for (var i in updates) {
    var update = updates[i];
    console.log('client updating port ' + update.path + ' to value ' + update.value);
    
    var obj = findObj(model, update.path);
    if(obj) 
      obj.last(update.value);
    else
      console.error('could not find ' + update.path + ' from update ');
  }
});

function findObj(obj, objPath) {
  var start = obj;
  if(!objPath.split)
    throw new Error('invalid path ' + JSON.stringify(objPath));
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
    updates.push({path: register.path, value: value});
  });
  if(updates.length) {
    ss.rpc('lophilo.multiwrite', updates, defaultCallback);
  }
}

console.log('App Loaded');