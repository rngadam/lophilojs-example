'use strict';

var lophilo = require('lophilo');

var local = {}
local.gpio0 = {}

function updater(ss, res) {
    var update = {};
    for (var port in lophilo.gpio0) {
      var currentValue = lophilo.gpio0[port].read();
      if(!local.gpio0[port]) {
        continue; // wait for load to create ports...
      }
      if (local.gpio0[port].value != currentValue) {
        local.gpio0[port].value = currentValue;
        update[port] = currentValue;
      }
    }
    if(Object.keys(update).length) {     
      ss.publish.all('update', update);
      if(res)
        res(null, "Server sent events for update");
    } else {
      if(res)
        res(null, null);        
    }
}

function createPortObject(shield, port, value) {
  var data = {};
  data.name = port;
  data.value = value;
  data.shield = shield;
  if(port.indexOf('io') === 0) {
    data.type = 'IO';
    data.id = parseInt(port.slice(2), 10);
    if(data.id <= 13) {
      data.side = 'L';
    } else {
      data.side = 'H';
    }
  } else {
    data.type = 'unknown';
  }
  return data;
}

exports.actions = function(req, res, ss) {
  //req.use('debug');
  
  clearInterval(updater);
  setInterval(updater.bind(null, ss), 100);
  
  return {
    load: function() {
      if(!Object.keys(local.gpio0).length) {
        for (var port in lophilo.gpio0) {
          if(!local.gpio0[port]) {
            local.gpio0[port] = createPortObject('A', port, lophilo.gpio0[port].read());
          } else {
            local.gpio0[port].value = lophilo.gpio0[port].read();
          }
        }
      }
      res(null, local.gpio0);
    },
    update: function() {
      updater(res);
    },
    write: function(name, value) {
      lophilo.gpio0[name].write(value);  
      setTimeout(updater.bind(null, ss), 0);
      res(null, "Server wrote the value");
    }
  };
};
