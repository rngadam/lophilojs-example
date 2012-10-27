'use strict';

var http = require('http'),
  ss = require('socketstream'),
  os = require('os');

function defaultHandler(err, port) {
  console.log('Listening on http://'+ os.hostname() + '.local:' + port);
}

exports.main = function(cb) {
  if (!cb) cb = defaultHandler;

  // Define a single-page client called 'main'
  ss.client.define('main', {
    view: 'app.html',
    css: ['app.styl', 'bootstrap', 'colorpicker.css'],
    code: [
      'libs/jquery.min.js', 
      'libs/bootstrap-colorpicker.js',       
      'libs/knockout-2.1.0.js', 
      'libs/bootstrap.js', 
      'libs/knockout.mapping-latest.js', 
      'app'],
    tmpl: '*'
  });

  // Serve this client on the root URL
  ss.http.route('/', function(req, res) {
    res.serveClient('main');
  });

  // Code Formatters
  ss.client.formatters.add(require('ss-stylus'));

  // Use server-side compiled Hogan (Mustache) templates. Others engines available
  ss.client.templateEngine.use(require('ss-hogan'));

  // Minimize and pack assets if you type: SS_ENV=production node app.js
  if (ss.env === 'production') ss.client.packAssets();

  // Start web server
  var server = http.Server(ss.http.middleware);
  // process.env.PORT: selected by cloud9
  // 0: let the operating system select the value
  server.listen(process.env.PORT || 0); 

  // Start SocketStream
  ss.start(server);
  cb(null, server.address().port);
};

if (require.main === module) {
  exports.main();
}
