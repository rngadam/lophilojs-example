'use strict';
/*global jQuery:true, $:true, ko:true, ss:true */

// Client Code

console.log('App Loading');

/*
 * LOGGING
 */
function debug(obj) {
  console.log(JSON.stringify(obj));
}

var MessageThrottler = function() {
  var self = this;
  self.lastMessage;
  self.lastMessageCount;
  self.conditionallyOutput = function(message, logger) {
    if (self.lastMessage !== message) {
      if (self.lastMessageCount > 1) {
        logger('last message repeated ' + self.lastMessageCount);
      }
      console.log(message);
      self.lastMessage = message;
      self.lastMessageCount = 0;
    }
    else {
      self.lastMessageCount++;
      if (self.lastMessageCount == 2) {
        logger('(last message repeating)');
      }
    }
  };
};

var log = function() {
  console.log.apply(console, arguments);
};
var logerr = function() {
  console.log.apply(console, arguments);
};

var messages = new MessageThrottler();

function defaultCallback(err, data) {
  if (err) {
    messages.conditionallyOutput(err, log);
  }
  else if (data) {
    messages.conditionallyOutput(data, logerr);
  }
}

/*
 * REFLECTION
 */
function turnObjectsIntoArray(src, array) {
  Object.keys(src).forEach(function(k) {
    var o = src[k];
    if (o.type) {
      array.push(o);
    }
  });
}

function findObj(obj, objPath) {
  var start = obj;
  if (!objPath) throw new Error('no path...');
  if (!objPath.split) throw new Error('invalid path ' + JSON.stringify(objPath));
  objPath = objPath.split('.');
  for (var i in objPath) {
    if (obj[objPath[i]]) {
      obj = obj[objPath[i]];
    }
  }
  if (obj !== start) {
    return obj;
  }
  else {
    return null;
  }
}

function recurseObject(object, objectFunction, path) {
  var properties = Object.keys(object);
  if (!path) {
    path = [];
  }
  for (var i in properties) {
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
  for (var i in properties) {
    var propertyName = properties[i];
    var obj = object[propertyName];
    fnc(obj, propertyName);
  }
}

/*
 * SERVER
 */
function multiwrite(value, target) {
  var updates = [];
  iterateObject(target, function(register) {
    if (!register.path) {
      console.log('no path available ');
      debug(register);
      return;
    }
    //debug(register);
    //console.log('checking ' + register.path());

    if (register.last() === value) {
      //console.log('value already updated for ' + register.name());
      return;
    }

    updates.push({
      path: register.path(),
      value: value
    });
  });
  if (updates.length) {
    //console.log('client multiwrite ' + JSON.stringify(updates));
    ss.rpc('lophilo.multiwrite', updates, defaultCallback);
  }
  else {
    console.log('no updates');
  }
}

/*
 * UI
 */
function setupColorPicker(label, path) {
  var colorpicker = $('#' + label);
  colorpicker.colorpicker({
    format: 'hex'
  });

  var o = findObj(model, path);
  colorpicker.colorpicker('setValue', o.srgb.hex());

  colorpicker.colorpicker().on('changeColor', function(ev) {
    o.srgb.hex(ev.color.toHex());
  });

  o.srgb.last.subscribe(function updateColorPicker(newValue) {
    colorpicker.colorpicker('setValue', o.srgb.hex());
  });
}

function setupSlider(name, setter) {
  //console.log('looking up ' + name);
  var o = $('#' + name);
  if(!o.length)
    console.log('not found: ' + name);
  o.slider({
    range: 'max',
    max: 0xFFFFFFFF,
    step: 100,
    value: setter(),
    slide: function(event, ui) {
      setter(ui.value);
    }
  });
  setter.subscribe(function(newValue) {
    o.slider('option', 'value', newValue);
  });
}

/*
 * MODEL
 */
function LophiloModel(data) {
  var self = this;

  console.log('loading data');
  console.dir(data);
  ko.mapping.fromJS(data, {}, self);

  console.dir(self);

  swapArrayMembersDependent(self.shields.al);
  createBitfields(self.shields.al);
  swapArrayMembersDependent(self.shields.ah);
  createBitfields(self.shields.ah);

  ko.mapping.defaultOptions().ignore = ["shields"];
  swapArrayMembersDependent(self.shields.bl);
  swapArrayMembersDependent(self.shields.bh);

  self.pwms = [];
  setupPWM(self.pwm0);

  self.leds.leds = [];
  turnObjectsIntoArray(self.leds, self.leds.leds);
  self.leds.led0.srgb.hex = makeComputedHex(self.leds.led0.srgb);
  self.leds.led1.srgb.hex = makeComputedHex(self.leds.led1.srgb);
  self.leds.led2.srgb.hex = makeComputedHex(self.leds.led2.srgb);
  self.leds.led3.srgb.hex = makeComputedHex(self.leds.led3.srgb);

  self.selectedPWM = ko.observable();

  self.allones = multiwrite.bind(null, 1);
  self.allzeros = multiwrite.bind(null, 0);
  
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

  function makeComputedInOutBitfieldValue(objPath, target) {
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
        if (value) {
          newValue = (1 << register.id()) | bitfield.last();
        }
        else {
          newValue = (~ (1 << register.id())) & bitfield.last();
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
    for (var i in array()) {
      var path = array()[i];
      var reg = findObj(self, path);
      // http://stackoverflow.com/questions/6425409/how-to-replace-a-given-index-element-in-knockoutjs
      array.replace(array()[i], reg);
    }
  }
  
  function makeComputedHex(obj) {
    return ko.computed({      
      'read': function() {
        return '#' + Number(obj.last()).toString(16);
      },
      'write':  function(newValue) {        
        var decimalValue = parseInt(newValue.slice(1), 16);
        ss.rpc('lophilo.write', obj.path(), decimalValue, defaultCallback);
      }
    } , self);
  }

  function makeComputedPercent(path, numerator, denominator) {
    return ko.computed({      
      'read': function() {
        return Math.round((numerator()/denominator())*100);
      },
      'write':  function(newValue) {        
        var count = Math.round((newValue/100)*denominator());
        ss.rpc('lophilo.write', path, count, defaultCallback);
      }
    } , self);
  }

  function makeComputedTime(path, count, frequency) {
    return ko.computed({      
      'read': function() {
        var tick_s = 1/frequency();
        var time = count()*tick_s;
        if(time > 1)
          return Math.ceil(time);
        else
          return time;
      },
      'write':  function(newTime) {    
        var tick_s = 1/frequency();        
        var count = Math.round(newTime/tick_s);
        ss.rpc('lophilo.write', path, count, defaultCallback);
      }
    } , self);
  }
  
  function makeComputedRangeValue(obj) {
    return ko.computed({      
      'read': function() {
        return obj.last();
      },
      'write':  function(newValue) {        
        ss.rpc('lophilo.write', obj.path(), newValue, defaultCallback);
      }
    } , self).extend({ throttle: self.updateIntervalMs() });
  }
  
  function createBitfields(array) {
    var bitfields = ['doe', 'din', 'dout', 'iclr', 'ie', 'iedge', 'iinv', 'imask'];

    array.bitfields = [];
    for (var k in bitfields) {
      k = 'unused';
      array.bitfields.push([]);
    }

    for (var i in array()) {
      var path = array()[i].path();
      for (var j in bitfields) {
        var bitfieldname = bitfields[j];
        var bitfield = {};
        bitfield.inout = makeComputedInOutBitfieldValue(path, 'gpio0.' + bitfieldname);
        bitfield.toggle = makeBitFieldToggle(bitfield.inout);
        bitfield.label = bitfieldname;
        array.bitfields[j].push(bitfield);
      }
    }
  }

  function makeToggle(fnc) {
    return function() {
      fnc(!fnc());
    };
  }
  
  function makeBoolean(obj) {
    return ko.computed({      
      'read': function() {
        return obj.last() === 1;
      },
      'write':  function(newValue) {        
        ss.rpc('lophilo.write', obj.path(), newValue ? 1 : 0, defaultCallback);
      }
    } , self);
  }
  
  function setupPWM(container) {
    iterateObject(container, function(obj) {
      if(!obj || !obj.type)
        return;
      self.pwms.push(obj);
      iterateObject(obj, function(register) {     
        if(!register.type || register.type() !== 'REGISTER')
          return;
        switch(register.name()) {
          case 'fmen':
          case 'pmen':
            // ignore for now
            break;
          case 'outinv':
            register.boolean = makeBoolean(register);          
            register.toggle = makeToggle(register.boolean);
            break;
          case 'dtyc':
            register.percent = makeComputedPercent(register.path(), register.last, obj.gate.last);
            register.jqueryid = 'slider_' + register.path().split('.').join('_');
            register.record = makeComputedRangeValue(register);
            break;
          case 'gate':
            register.jqueryid = 'slider_' + register.path().split('.').join('_');
            register.record = makeComputedRangeValue(register);
            register.time = makeComputedTime(
              register.path(), 
              register.last, 
              function() { return 200*1e6; },
              function() { return 1000; /*ms*/ });
            break;
          default:
//            log('error, unsupported: ' + register.name());
            break;
        }
      });
    });
  }

  function addResetObservable(observed, register) {
    observed.subscribe(function(newValue) {
      ss.rpc('lophilo.write', register.path(), 0, defaultCallback);
    });
  }

  self.selectPWM = function(pwm) {
    console.log('selecting PWM');
    self.selectedPWM(pwm);
    setupSlider(pwm.gate.jqueryid, pwm.gate.record);    
    setupSlider(pwm.dtyc.jqueryid, pwm.dtyc.record); 
    
    //TODO keep observables return and dispose() at the end
    addResetObservable(pwm.gate.record, pwm.reset);
    addResetObservable(pwm.dtyc.record, pwm.reset);  
    //addResetObservable(pwm.pmen.boolean, pwm.reset);
    //addResetObservable(pwm.fmen.boolean, pwm.reset);   
    addResetObservable(pwm.outinv.boolean, pwm.reset);       
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
      ss.rpc('lophilo.power',
      value ? self.SHIELDS_POWER_ON() : self.SHIELDS_POWER_OFF(),
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
  
  self.resetAllPWM = function() {
    var updates = [];
    iterateObject(self.pwm0, function(pwm) {
      if(!pwm.reset)
        return;
      updates.push({path: pwm.dtyc.path(), value: 0x0});
      updates.push({path: pwm.gate.path(), value: 0x0});
      updates.push({path: pwm.reset.path(), value: 0x0});
      updates.push({path: pwm.fmen.path(), value: 0x0});
      updates.push({path: pwm.pmen.path(), value: 0x0});
      updates.push({path: pwm.outinv.path(), value: 0x0});
    });
    ss.rpc('lophilo.multiwrite', updates, defaultCallback);
  };

  self.setPWMClock = function() {
    var updates = [];
    var tick = 1/(200*1e6);   // 5e-9
    var power = -8;
    var time;
    
    iterateObject(self.pwm0, function(pwm) {
      if(!pwm.reset)
        return;      
      if(power < 0) {
        time = eval('1e'+power);
        power++;
      } else {
        time += 1;
      }
      var gate = time/tick;
      if((gate) > Math.pow(2, 32)) {
        log('gate too large for ' + pwm.label() + ' with ' + time + 's');
      }      
      
      var dtyc = 0.5*gate;
      updates.push({path: pwm.dtyc.path(), value: Math.round(dtyc)});
      updates.push({path: pwm.gate.path(), value: Math.round(gate)});
      updates.push({path: pwm.outinv.path(), value: 0x0});
      updates.push({path: pwm.reset.path(), value: 0x0});
    });
    debug(updates);    
    ss.rpc('lophilo.multiwrite', updates, defaultCallback);
  };
}

var model;

/*
 * INITIAL LOAD AND KNOCKOUT BINDING
 */
ss.rpc('lophilo.load', function(err, data) {
  model = new LophiloModel(data);
  ko.applyBindings(model);
  console.log('bindings applied');
  
  // now setup javascript that is generated from the KO bindings!
  setupColorPicker('F0', 'leds.led0');
  setupColorPicker('F1', 'leds.led1');
  setupColorPicker('F2', 'leds.led2');
  setupColorPicker('F3', 'leds.led3');

  console.log('javascript hooks added');

});

ss.event.on('update', function(updates) {
  //console.log('client received update ' + JSON.stringify(updates));
  if (!model) {
    console.log('event received before model created!');
  }
  for (var i in updates) {
    var update = updates[i];
    //console.log('client updating port ' + update.path + ' to value ' + update.value);

    var obj = findObj(model, update.path);
    if (obj) obj.last(update.value);
    else console.error('could not find ' + update.path + ' from update ');
  }
});



console.log('App Loaded');