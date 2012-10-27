'use strict';
/*global jQuery:true, ko:true, ss:true */

// Client Code

console.log('App Loading');

function debug(obj) {
  console.log(JSON.stringify(obj));
}

function turnObjectsIntoArray(src, array) {
  Object.keys(src).forEach(function(k) {
    var o = src[k];
    if(o.type) {      
      array.push(o);
    }
  });
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
  
  function makeBitFieldToggle(inout) {
    return function() {
      inout(!inout());
    };
  }  
  function swapArrayMembersDependent(array) {
    for(var i in array()) {
      var path = array()[i];
      var reg = findObj(self, path);
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
      k = 'unused';
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
  
  self.leds.leds = [];
  turnObjectsIntoArray(self.leds, self.leds.leds );

  ko.mapping.defaultOptions().ignore = ["shields"];
  
  self.selectedPWM = ko.observable();
  self.selectPWM = function(pwm) {
    console.log('selecting PWM');
    self.selectedPWM(pwm);
  };
  self.applyPWM = function() {
    console.log('applying PWM settings');
    var updates = [];
    for(var i in self.selectedPWM()) {
      var reg = self.selectedPWM()[i];
      updates.push({path: reg.path, value: reg.value});
    }
  };
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

  // now setup javascript that is generated from the KO bindings!
  setupColorPicker('F0', 'leds.led0');
  setupColorPicker('F1', 'leds.led1');
  setupColorPicker('F2', 'leds.led2');
  setupColorPicker('F3', 'leds.led3'); 
  
});

var MessageThrottler = function() {
  var self = this;  
  self.lastMessage;
  self.lastMessageCount;
  self.conditionallyOutput = function(message, logger) {
    if(self.lastMessage !== message) {
      if(self.lastMessageCount > 1) {
        logger('last message repeated ' + self.lastMessageCount);
      }
      console.log(message);
      self.lastMessage = message;
      self.lastMessageCount = 0;        
    } else {
      self.lastMessageCount++;
      if(self.lastMessageCount == 2) {
        logger('(last message repeating)');
      }
    }
  };
};

var log = function () { console.log.apply(console, arguments); };
var logerr = function () { console.log.apply(console, arguments); };

var messages = new MessageThrottler();
function defaultCallback(err, data) {
    if(err) {    
      messages.conditionallyOutput(err, log);  
    }
    else if(data) {
      messages.conditionallyOutput(data, logerr);  
    }
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

function setupColorPicker(label, path) {
  var colorpicker = $('#' + label);
  colorpicker.colorpicker({
    format: 'hex'
  });

  var o = findObj(model, path);
  colorpicker.colorpicker('setValue', '#' + Number(o.srgb.last()).toString(16));
  
  colorpicker.colorpicker().on('changeColor', function(ev){
    var values =  ev.color.toRGB();
    //console.log(label + ' changed color ' + JSON.stringify(values));
    var updates = [];
    updates.push({path: path + '.r', value: values.r});
    updates.push({path: path + '.g', value: values.g});
    updates.push({path: path + '.b', value: values.b});
    //console.log(label + ' updates ' + JSON.stringify(updates));
    ss.rpc('lophilo.multiwrite', updates, defaultCallback);    
    // TODO figure out a way to update the hex field in realtime
    colorpicker.val(ev.color.toHex());
  });          
  
  o.srgb.last.subscribe(function updateColorPicker(newValue) {
    colorpicker.colorpicker('setValue', '#' + Number(newValue).toString(16));
  });  
  // TODO: find a better way to get the hexa values to update
  colorpicker.colorpicker('show');
  colorpicker.colorpicker('hide');
}
  
function findObj(obj, objPath) {
  var start = obj;
  if(!objPath) 
    throw new Error('no path...');
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