'use strict';

var lophilo = require('lophilo');

exports.actions = function(req, res, ss) {
  //req.use('debug');  
  
  // all updates sent to the UI
  function passThroughUpdateCallback(update) {    
    if(typeof update === 'object')
      ss.publish.all('update', update);
    else 
      console.error('invalid update given, got: ' + update);
  }
  return {
    load: function() {
      lophilo.watch(/gpio0.io/);
      lophilo.watch(/power/);       
      lophilo.removeAllListeners('update');      
      lophilo.on('update', passThroughUpdateCallback);
      lophilo.readAll(function() {
        res(null, lophilo);
      });
    },
    write: function(path, value) {
      if(!path) res('no path given for write');
      if(!value) res('no value given for write');
      lophilo.write(path, value, res); 
    },
    read: function(path) {
      if(!path) res('no path given for read');
      lophilo.read(path, res); 
    },
    power: function(status) {
      if(status) {
        lophilo.powerOnShields();
        res(null, 'Powered on');
      } else {
        lophilo.powerOffShields();
        res(null, 'Powered off');
      }
    },
    multiwrite: function(updates) {
      if(!updates) res('array parameter required');
      if(!updates instanceof Array) res('must be an array, got: ' + updates);
      lophilo.multiWrite(updates, res);
    }
  };
};
