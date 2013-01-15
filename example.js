var oauth = require('./lib/oauth');

var endpoint = 'https://5apps.com/rs/oauth/jcoglan',
    client   = 'Vault',
    scopes   = ['vault:rw'],
    options  = {browser: process.env.BROWSER, inline: process.env.INLINE};

oauth.authorize(endpoint, client, scopes, options, function(error, token) {
  console.log(error, token);
  process.exit();
});

