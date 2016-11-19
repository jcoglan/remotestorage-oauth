# remotestorage-oauth

This library allows command-line Node programs to obtain an OAuth access token
from a remoteStorage server. It does this in one of two ways:

* It opens the OAuth provider site in the user's preferred browser, and launches
  an HTTP server for the provider to redirect back to, to capture the token
* It launches a text-mode browser in the terminal and accesses the provider site
  through an HTTP proxy


## Usage

Call `oauth.authorize()` with the authorization URL, the client ID, the required
scopes, and an options object. The callback is called with an error or a token
response, depending on the result of the authorization request.

```js
var oauth = require('remotestorage-oauth');

var endpoint = 'https://5apps.com/rs/oauth/jcoglan',
    client   = 'Vault',
    scopes   = ['vault:rw'],
    options  = {browser: process.env.BROWSER, inline: process.env.INLINE};

oauth.authorize(endpoint, client, scopes, options, function(error, token) {
  console.log(error, token);
  process.exit();
});
```

Available options are:

* `browser`: The name of the web browser executable. Defaults to either `open`,
  `xdg-open`, or `start` depending on your OS. This has been tested with
  `elinks` and `w3m`.
* `inline`: Set to `true` if you want to run a text-mode browser in the current
  shell. This option makes the browser access the provider through a local
  proxy.
* `ca`: A buffer containing a certificate to be used to make HTTPS requests.
  Required if using the `inline` option against a server with a self-signed or
  other untrusted certificate.
