'use strict';

var lophilo = require('lophilo');


exports.actions = function(req, res, ss) {
  //req.use('debug');  

  return {
    load: function() {
      lophilo.removeAllListeners('gpio.io');
      lophilo.unwatch(/gpio0.io/);      
      lophilo.on('gpio.io', function(update) {
        ss.publish.all('update', update);
      });
      lophilo.watch('gpio.io', /gpio0.io/);      
      lophilo.readAll(function() {
        res(null, lophilo);
      });
    },
    write: function(path, value) {
      if(!path) res('no path!');
      if(!value) res('no value!');
      lophilo.write(path, value, res); 
    },
    read: function(path) {
      if(!path) res('no path!');
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
    }    
  };
};
