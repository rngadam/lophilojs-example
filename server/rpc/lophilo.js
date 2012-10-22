'use strict';
var lophilo = require('lophilo');

var local = {}
local.gpio0 = {}

exports.actions = function(req, res, ss) {
  //req.use('debug');
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
        res(null, "Server sent events for update");
      } else {
        res(null, null);        
      }
      
    },
    write: function(name, value) {
      lophilo.gpio0[name].write(value);  
      var update = {};
      update[name] = value;
      ss.publish.all('update', update);
      res(null, "Server wrote the value");
    }
  };
};
