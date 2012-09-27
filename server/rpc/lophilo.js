var lophilo = require('lophilo');

exports.actions = function(req, res, ss) {
	req.use('debug');
	return {
		readShieldA: function() {
		    var values = [];
		    for(var port in lophilo.gpio0) {
		        values.push({name: port, bit: lophilo.gpio0[port].read()});
		    }
		    res(values);
		},
		write: function(name, value) {
			lophilo.gpio0[name].write(value);
			res(value);
		}
	}
};