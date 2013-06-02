var child = require('child_process'),
    fs    = require('fs'),
    http  = require('http'),
    qs    = require('querystring'),
    url   = require('url'),
    Proxy = require('./proxy');

var extractToken = function(query, callback) {
  var params = qs.parse(query),
      token  = params.access_token,
      error  = params.error ? new Error(params.error_description || params.error) : null;

  if (error) error.type = params.error;
  callback(error, token ? params : null);
};

var authorize = function(target, clientId, scopes, options, callback) {
  options = options || {};

  var uri    = url.parse(target, true),
      inline = options.inline,
      browser,
      server;

  var receiver = http.createServer(function(request, response) {
    Proxy.buffer(request, function() {
      if (url.parse(request.url).pathname !== '/') {
        response.writeHead(404, {});
        return response.end();
      }

      if (request.method === 'GET') {
        fs.readFile(__dirname + '/receive.html', function(error, content) {
          response.writeHead(200, {'Content-Type': 'text/html'});
          response.end(content, 'utf8');
        });
      }
      else if (request.method === 'POST') {
        response.writeHead(200, {});
        response.end();
        receiver.close();
        extractToken(request.body, callback);
      }
    });
  });

  var proxy = Proxy.createPool({ca: options.ca}, function(status, location) {
    var uri  = url.parse(location || ''),
        hash = uri.hash || uri.search;

    if (status < 301 || status > 303 || !/\b(error|access_token)=/.test(hash))
      return false;

    browser.kill();
    proxy.close();
    extractToken(hash.replace(/^(#|\?)/, ''), callback);
    return true;
  });

  server = inline ? proxy.forOrigin(uri) : receiver;

  server.listen(0, function() {
    var addr   = server.address(),
        client = 'http://' + addr.address + ':' + addr.port,
        params = {client_id: clientId, redirect_uri: client + '/', response_type: 'token', scope: scopes.join(' ')};

    var providerUrl = inline ? client + uri.path : target;

    providerUrl += (/\?/.test(providerUrl) ? '&' : '?') + qs.stringify(params);

    var cmds    = {win32: 'cmd', darwin: 'open', other: 'xdg-open'},
        command = options.browser || cmds[process.platform] || cmds.other,
        args    = (command === 'cmd') ? ['/c', 'start', '""', providerUrl] : [providerUrl],
        opts    = {};

    if (inline) opts.stdio = [0, 2, 2];
    browser = child.spawn(command, args, opts);
  });
};

module.exports = {
  authorize: authorize
};

