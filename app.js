// My SocketStream 0.3 app

var http = require('http'),
    ss = require('socketstream');

function defaultHandler(err, port) {
	console.log('Listening on port ' + port);
}

function main(cb) {
	if(!cb)
		cb = defaultHandler;

	// Define a single-page client called 'main'
	ss.client.define('main', {
	  view: 'app.html',
	  css:  ['app.styl'],
	  code: ['libs/jquery.min.js', 'libs/knockout-2.1.0.js', 'libs/bootstrap.js', 'app'],
	  tmpl: '*'
	});

	// Serve this client on the root URL
	ss.http.route('/', function(req, res){
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
	server.listen(0);

	// Start SocketStream
	ss.start(server);
	cb(null, server.address().port);
}

if (require.main === module) {
	main();
}
