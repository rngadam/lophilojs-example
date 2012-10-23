'use strict';

var lophilo = require('lophilo');

var local = {}
local.gpio0 = {}

function updater(ss, res) {
    var update = {};
    for (var port in lophilo.gpio0) {
      var currentValue = lophilo.gpio0[port].read();
      if (local.gpio0[port] != currentValue) {
        local.gpio0[port] = currentValue;
        update[port] = currentValue;
      }
    }
    if(Object.keys(update).length) {     
      console.log('publishing update!');
      ss.publish.all('update', update);
      if(res)
        res(null, "Server sent events for update");
    } else {
      if(res)
        res(null, null);        
    }
}


exports.actions = function(req, res, ss) {
  //req.use('debug');
  
  clearInterval(updater);
  setInterval(updater.bind(null, ss), 100);
  
  return {
    load: function() {
      if(!Object.keys(local.gpio0).length) {
        for (var port in lophilo.gpio0) {
          local.gpio0[port] = lophilo.gpio0[port].read();
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
