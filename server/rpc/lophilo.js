var lophilo = require('lophilo');

exports.readShieldA = function(res) {
    var values = [];
    for(var port in lophilo.gpio0) {
        values.push({name: port, value: lophilo.gpio0[port].read()});
    }
    res(values);
};