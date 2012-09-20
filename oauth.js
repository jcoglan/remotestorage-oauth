var child = require('child_process'),
    fs    = require('fs'),
    http  = require('http'),
    qs    = require('querystring');

var authenticate = function(target, clientId, scopes, callback) {
  var server = http.createServer(function(request, response) {
    var body = '';
    request.setEncoding('utf-8');
    request.addListener('data', function(c) { body += c });
    request.addListener('end', function() {
      if (request.url !== '/') {
        response.writeHead(404, {});
        return response.end();
      }
      
      if (request.method === 'GET') {
        fs.readFile(__dirname + '/receive.html', function(error, content) {
          response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
          response.write(content, 'utf-8');
          response.end();
        });
      }
      else if (request.method === 'POST') {
        response.writeHead(200, {});
        response.end();
        server.close();
        
        var params = qs.parse(body),
            token  = params.access_token,
            error  = params.hasOwnProperty('error') ? new Error(params.error_description) : null;
        
        if (error) error.type = params.error;
        callback(error, token);
      }
    });
  });
  
  server.listen(0, function() {
    var client = 'http://127.0.0.1:' + server.address().port + '/',
        params = {client_id: clientId, redirect_uri: client , response_type: 'token', scope: scopes.join(' ')},
        pairs  = [],
        cmds   = {win32: 'cmd', darwin: 'open', other: 'xdg-open'};
    
    for (var key in params)
      pairs.push(key + '=' + encodeURIComponent(params[key]));
    
    target += '?' + pairs.join('&');
    
    var cmd  = cmds[process.platform] || cmds.other,
        args = (process.platform === 'win32') ? ['/c', 'start', '""', target] : [target];
    
    child.execFile(cmd, args);
  });
};

// e.g.
authenticate('https://local.dev/oauth/me', 'vault', ['vault:rw'], function(error, token) {
  console.log(token);
  process.exit();
});
