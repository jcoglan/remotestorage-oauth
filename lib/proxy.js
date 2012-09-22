var http  = require('http'),
    https = require('https'),
    url   = require('url');

var Proxy = function(pool, origin) {
  var uri = url.parse(origin);
  
  this._server = http.createServer(function(request, response) {
    var client = (uri.protocol === 'https:') ? https : http,
        requri = url.parse(request.url);
    
    request.headers.host = uri.host;
    delete request.headers['accept-encoding'];
    
    var req = client.request({
      host:     uri.host,
      port:     uri.port,
      method:   request.method,
      path:     requri.path,
      headers:  request.headers
    });
    req.addListener('response', function(res) {
      Proxy.buffer(res, function() {
        pool.rewrite(res, function() {
          if (pool.filter(res)) return;
          response.writeHead(res.statusCode, res.headers);
          response.end(res.body);
        });
      });
    });
    request.pipe(req);
  });
};

['listen', 'close', 'address'].forEach(function(method) {
  Proxy.prototype[method] = function() {
    return this._server[method].apply(this._server, arguments);
  };
});

var Pool = function(filter) {
  this._filter  = filter;
  this._proxies = {};
};

Pool.prototype.close = function() {
  for (var origin in this._proxies) this._proxies[origin].close();
};

Pool.prototype.filter = function(response) {
  return this._filter(response);
};

Pool.prototype.forOrigin = function(origin, filter) {
  this._proxies[origin] = this._proxies[origin] || new Proxy(this, origin);
  return this._proxies[origin];
};

Pool.prototype.listen = function(origin, callback) {
  var proxy = this.forOrigin(origin),
      addr  = proxy.address();
  
  if (addr) return callback('http://' + addr.address + ':' + addr.port);
  
  proxy.listen(0, function() {
    var addr = proxy.address();
    callback('http://' + addr.address + ':' + addr.port);
  });
};

Pool.prototype.rewrite = function(response, callback) {
  delete response.headers['content-length'];
  
  var location = response.headers.location;
  if (location === undefined) return callback();
  
  var uri    = url.parse(location),
      origin = uri.protocol + '//' + uri.host;
  
  if (uri.hostname === '0.0.0.0') return callback();
  
  this.listen(origin, function(host) {
    response.headers.location = host + uri.path;
    callback();
  });
};

Proxy.buffer = function(stream, callback) {
  var body = '';
  stream.setEncoding('utf-8');
  stream.addListener('data', function(c) { body += c });
  stream.addListener('end', function() {
    stream.body = body;
    callback();
  });
};

Proxy.createPool = function(filter) {
  return new Pool(filter);
};

module.exports = Proxy;

