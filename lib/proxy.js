var http  = require('http'),
    https = require('https'),
    url   = require('url');

var proxy = function(pool, origin) {
  var uri = url.parse(origin);

  return http.createServer(function(request, response) {
    if (pool.filter(302, request.url)) return;

    var client = (uri.protocol === 'https:') ? https : http,
        requri = url.parse(request.url);

    request.headers.host = uri.host;
    delete request.headers['accept-encoding'];

    request.on('error', function() { returnError(response) });
    response.on('error', function() {});

    var requestOptions = {
      host:     uri.host,
      port:     uri.port,
      method:   request.method,
      path:     requri.path,
      headers:  request.headers
    };
    if (pool._options.ca) requestOptions.ca = pool._options.ca;
    var req = client.request(requestOptions);

    req.on('response', function(res) {
      proxy.buffer(res, function() {
        pool.rewrite(res);
        if (pool.filter(res.statusCode, res.headers.location)) return;
        response.writeHead(res.statusCode, res.headers);
        response.end(res.body);
      });
    });
    req.on('error', function() { returnError(response) });
    request.pipe(req);
  });
};

var returnError = function(response) {
  response.writeHead(500, {});
  response.end();
};

var Pool = function(options, filter) {
  this._options = options;
  this._filter  = filter;
  this._proxies = {};
};

Pool.prototype.close = function() {
  for (var origin in this._proxies) this._proxies[origin].close();
};

Pool.prototype.filter = function(status, location) {
  return this._filter(status, location);
};

Pool.prototype.forOrigin = function(uri, filter) {
  var origin = uri.protocol + '//' + uri.host;
  this._proxies[origin] = this._proxies[origin] || proxy(this, origin);
  return this._proxies[origin];
};

Pool.prototype.listen = function(origin, callback) {
  var proxy = this.forOrigin(origin),
      addr  = proxy.address();

  if (!addr) {
    proxy.listen(0);
    addr = proxy.address();
  }
  var host = 'http://' + addr.address + ':' + addr.port;
  if (callback) callback(host);
  return host;
};

Pool.prototype.rewrite = function(response) {
  delete response.headers['content-length'];
  var self = this;

  response.body = response.body.replace(/\b(action|href)=('[^']*?'|"[^"]*?"|\S*)/g, function(match, attr, value) {
    value = value.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    var href = url.parse(value);
    if (href.protocol) value = self.listen(href) + href.path;
    return attr + '="' + value + '"';
  });

  var location = response.headers.location;
  if (location === undefined) return;

  var uri = url.parse(location);
  if (uri.hostname === '0.0.0.0') return;
  response.headers.location = this.listen(uri) + uri.path;
};

proxy.buffer = function(stream, callback) {
  var body = '';
  stream.setEncoding('utf8');
  stream.on('data', function(c) { body += c });
  stream.on('end', function() {
    stream.body = body;
    callback();
  });
};

proxy.createPool = function(options, filter) {
  return new Pool(options, filter);
};

module.exports = proxy;

