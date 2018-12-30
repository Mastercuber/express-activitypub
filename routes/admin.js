'use strict';
const express = require('express'),
      router = express.Router(),
      crypto = require('crypto'),
      generateRSAKeypair = require('generate-rsa-keypair');

const Webfinger = require('webfinger.js');

const webfinger = new Webfinger({
    webfist_fallback: false,  // defaults to false
    tls_only: false,          // defaults to true
    uri_fallback: false,     // defaults to false
    request_timeout: 10000,
});

function createActor(name, domain, pubkey) {
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],

    'id': `https://${domain}/u/${name}`,
    'type': 'Person',
    'preferredUsername': `${name}`,
    'inbox': `https://${domain}/api/inbox`,
    'followers': `https://${domain}/u/${name}/followers`,
    'publicKey': {
      'id': `https://${domain}/u/${name}#main-key`,
      'owner': `https://${domain}/u/${name}`,
      'publicKeyPem': pubkey
    }
  };
}

function createWebfinger(name, domain) {
  return {
    'subject': `acct:${name}@${domain}`,

    'links': [
      {
        'rel': 'self',
        'type': 'application/activity+json',
        'href': `https://${domain}/u/${name}`
      }
    ]
  };
}

function createFollowerCollection(name, domain) {
  return {
      "@context": "https://www.w3.org/ns/activitystreams",
      "id": `https://${domain}/u/${name}/followers`,
      "summary": `${name}\'s followers collection`,
      "type": "OrderedCollection",
      "totalItems": 1,
      "orderedItems": [
          {
              '@context': [
                  'https://www.w3.org/ns/activitystreams',
                  'https://w3id.org/security/v1'
              ],

              'id': `https://${domain}/u/${name}`,
              'type': 'Person',
              'preferredUsername': `${name}`,
              'inbox': `https://${domain}/api/inbox`,
              'followers': `https://${domain}/u/${name}/followers`,
              'publicKey': {
                  'id': `https://${domain}/u/${name}#main-key`,
                  'owner': `https://${domain}/u/${name}`,
                  'publicKeyPem': pubkey
              }
        }
      ]
  }
}

router.post('/create', function (req, res) {
  // pass in a name for an account, if the account doesn't exist, create it!
  const account = req.body.account;
  if (account === undefined) {
    return res.status(400).json({msg: 'Bad request. Please make sure "account" is a property in the POST body.'});
  }
  let db = req.app.get('db');
  let domain = req.app.get('domain');
  // create keypair
  var pair = generateRSAKeypair();
  let actorRecord = createActor(account, domain, pair.public);
  let webfingerRecord = createWebfinger(account, domain);
  //const followerCollection = createFollowerCollection(account, domain);
  const apikey = crypto.randomBytes(16).toString('hex');
  db.run('insert or replace into accounts(name, actor, apikey, pubkey, privkey, webfinger) values($name, $actor, $apikey, $pubkey, $privkey, $webfinger)', {
    $name: `${account}@${domain}`,
    $apikey: apikey,
    $pubkey: pair.public,
    $privkey: pair.private,
    $actor: JSON.stringify(actorRecord),
    $webfinger: JSON.stringify(webfingerRecord)
  }, (err, accounts) => {
      console.log(JSON.stringify(err, null, 2))
      console.log(JSON.stringify(accounts, null, 2))
      res.status(200).json({msg: 'ok', apikey});
  });
});

router.post('/follow', (req, res) => {
    let db = req.app.get('db');
    let domain = req.app.get('domain');
    let acct = req.body.acct;
    let apikey = req.body.apiKey;
    let wantToFollow = req.body.wantToFollow;
    // check to see if your API key matches
    db.get('select apikey from accounts where name = $name', {$name: `${acct}`}, (err, result) => {
        if (result.apikey === apikey) {
            follow(acct, wantToFollow)
        }
        else {
            res.status(403).json({msg: 'wrong api key'});
        }
    });
})

function follow(acct, wantToFollow) {
    // user is allowed to use api
    webfinger.lookup(wantToFollow, function (err, p) {
        if (err) {
            console.log('error: ', err.message);
        } else {
            console.log(p);
        }
    });
}

module.exports = router;
