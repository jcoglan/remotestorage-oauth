var child = require('child_process'),
    fs    = require('fs'),
    http  = require('http'),
    qs    = require('querystring'),
    url   = require('url'),
    Proxy = require('./proxy');

var extractToken = function(query, callback) {
  var params = qs.parse(query),
      token  = params.access_token,
      error  = params.hasOwnProperty('error') ? new Error(params.error_description) : null;
  
  if (error) error.type = params.error;
  callback(error, token);
};

var authenticate = function(target, clientId, scopes, callback) {
  var uri    = url.parse(target, true),
      inline = (process.env.INLINE !== undefined),
      browser,
      server;
  
  var receiver = http.createServer(function(request, response) {
    Proxy.buffer(request, function() {
      if (request.url !== '/') {
        response.writeHead(404, {});
        return response.end();
      }
      
      if (request.method === 'GET') {
        fs.readFile(__dirname + '/receive.html', function(error, content) {
          response.writeHead(200, {'Content-Type': 'text/html'});
          response.end(content, 'utf-8');
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
  
  var proxy = Proxy.createPool(function(res) {
    var hash = url.parse(res.headers.location || '').hash || '';
    
    if (res.statusCode < 301 || res.statusCode > 303 || !/\baccess_token=/.test(hash))
      return false;
    
    browser.kill();
    proxy.close();
    extractToken(hash.substr(1), callback);
    return true;
  });
  
  server = inline ? proxy.forOrigin(uri.protocol + '//' + uri.host) : receiver;
  
  server.listen(0, function() {
    var addr   = server.address(),
        client = 'http://' + addr.address + ':' + addr.port + '/',
        params = {client_id: clientId, redirect_uri: client, response_type: 'token', scope: scopes.join(' ')};
    
    var providerUrl = inline
                    ? 'http://' + addr.address + ':' + addr.port + uri.pathname + (uri.search || '')
                    : target;
    
    providerUrl += '?' + qs.stringify(params);
    
    var cmds    = {win32: 'cmd', darwin: 'open', other: 'xdg-open'},
        command = process.env.CMD || cmds[process.platform] || cmds.other,
        args    = (command === 'cmd') ? ['/c', 'start', '""', providerUrl] : [providerUrl],
        options = {};
    
    if (inline) options.stdio = [0,2,2];
    browser = child.spawn(command, args, options);
  });
};

// e.g.
authenticate('https://5apps.com/rs/oauth/jcoglan', 'vault', ['vault:rw'], function(error, token) {
  console.log('TOKEN', token);
  process.exit();
});

