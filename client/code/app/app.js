'use strict';
/*global jQuery:true, ko:true, ss:true */

// Client Code

console.log('App Loading');

function debug(obj) {
  console.log(JSON.stringify(obj));
}

function LophiloModel(data) {
  var self = this;
  
  // we want to preserve the value of port at creation, so 
  // we need to create the function inside another function with the 
  // proper port as parameter
  function makeComputedLastValue(objPath) {
    return ko.computed(
      function() { 
        var obj = findObj(self, objPath);
        return obj.last(); 
      }, 
      self);
  }
  
  function makeComputedInOutValue(objPath, target) {
      return ko.computed({
        'read': function() {
          var register = findObj(self, objPath);
          var bitfield = findObj(self, target);
          return (1 << register.id() & bitfield.last()) !== 0;
        },
        'write': function(value) {
          var register = findObj(self, objPath);
          var bitfield = findObj(self, target);          
          var newValue;
          if(value) {
            newValue = (1 << register.id()) |  bitfield.last();
          } else {
            newValue = (~(1 << register.id())) & bitfield.last();
          }
          ss.rpc('lophilo.write', target, newValue, defaultCallback);
        }
      }, self);    
  }
  
//  function makeBitFieldToggle(objPath, targetProperty) {
//    return function() {
//      var obj = findObj(self, objPath);
//      obj[targetProperty](!obj[targetProperty]());
//    };
//  }
  
  function makeBitFieldToggle(inout) {
    return function() {
      inout(!inout());
    };
  }  
  function swapArrayMembersDependent(array) {
    for(var i in array()) {
      var path = array()[i];
      //console.log(path);  
      var reg = findObj(self, path);
  
      //var copy = jQuery.extend({}, reg); 
      
      // http://stackoverflow.com/questions/6425409/how-to-replace-a-given-index-element-in-knockoutjs
      array.replace(array()[i], reg); 
    }
  }
  
  function createBitfields(array) {
    var bitfields = [
        'doe', 'din', 'dout', 'iclr', 'ie', 'iedge', 'iinv', 'imask'
    ];
        
    array.bitfields = [];
    for(var k in bitfields) {
      array.bitfields.push([]);
    }
    
    for(var i in array()) {
      var path = array()[i].path();    
      for(var j in bitfields) {
        var bitfieldname = bitfields[j];
        var bitfield = {};
        bitfield.inout = makeComputedInOutValue(path, 'gpio0.' + bitfieldname);
        bitfield.toggle = makeBitFieldToggle(bitfield.inout);  
        bitfield.label = bitfieldname;
        array.bitfields[j].push(bitfield);
      }    
    }
  }
  
  console.log('loading data');
  console.dir(data);
  ko.mapping.fromJS(data, {}, self);
  console.dir(self);

  swapArrayMembersDependent(self.shields.al);
  createBitfields(self.shields.al);
  swapArrayMembersDependent(self.shields.ah);
  createBitfields(self.shields.ah);  
  swapArrayMembersDependent(self.shields.bl);
  swapArrayMembersDependent(self.shields.bh);

  ko.mapping.defaultOptions().ignore = ["shields"];

  self.reload = function() {
    ss.rpc('lophilo.load', function(err, data) {
      console.dir(data);      
      ko.mapping.fromJS(data, self);   
      console.dir(self);      
    });    
  };
  

  
  /* on/off toggling */
  self.toggle = function(register) {
    var targetValue = register.last() === 0 ? 1 : 0;
    console.log('client writing %s from value %s to %d', register.path(), register.last(), targetValue);
    ss.rpc('lophilo.write', register.path(), targetValue, defaultCallback);
  };
  
  /** POWER TOGGLER **/
  self.togglepower = function() {
    self.powerstatus(self.powerstatus() ? false : true);
  };
  self.powerstatus = ko.computed({
    read: function() {
      return self.sys.power.last() === self.SHIELDS_POWER_ON();
    },
    write: function(value) {
      ss.rpc(
        'lophilo.power', 
        value ?  self.SHIELDS_POWER_ON() : self.SHIELDS_POWER_OFF(), 
        defaultCallback);
    }
  }, self);   
  
  /** OUTPUT ENABLE TOGGLER **/  
  self.shields.toggleOutputEnable = function() {
    self.shields.outputEnable(self.shields.outputEnable() ? false : true);
  };  
  self.shields.outputEnable = ko.computed({
    'read': function() {
      // 0x0 is all off, any other value is from 1 to max leds on!
      return self.gpio0.doe.last() !== self.GPIO_ALL_OFF();
    },
    'write': function(value) {
      console.log(value);
      ss.rpc('lophilo.write', 'gpio0.doe', 
        value ? self.GPIO_ALL_ON() : self.GPIO_ALL_OFF(), defaultCallback);  
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
  //console.log('client received update ' + JSON.stringify(updates));
  if(!model) {
   console.log('event received before model created!');
  }
  for (var i in updates) {
    var update = updates[i];
    //console.log('client updating port ' + update.path + ' to value ' + update.value);
    
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
  var properties = Object.keys(object);
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
  var properties = Object.keys(object);
	for(var i in properties) {
		var propertyName = properties[i];
		var obj = object[propertyName];
		fnc(obj, propertyName);
	}
}

function multiwrite(value, target) {
  var updates = [];
  iterateObject(target, function(register) {
    if(!register.path) {
      console.log('no path available ');
      debug(register);
      return;
    } 
    //debug(register);
    //console.log('checking ' + register.path());
       
    if(register.last() === value)  {
      //console.log('value already updated for ' + register.name());
      return;
    }
     
    updates.push({path: register.path(), value: value});
  });
  if(updates.length) {
    //console.log('client multiwrite ' + JSON.stringify(updates));
    ss.rpc('lophilo.multiwrite', updates, defaultCallback);
  } else {
    console.log('no updates');
  }
}

console.log('App Loaded');