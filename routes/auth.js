var express = require('express');
var router = express.Router();

/* GET auth page. */
router.get('/', function(req, res) {
    if (req.params.name !== undefined && req.params.pass !== undefined) {
        res.render('index', {title: 'success'});
    }
    else {
        res.render('auth', { title: 'Auth' });
    }
});

router.post('/', function(req, res) {
    getData(req.body.user, req.body.pass, res);
});

module.exports = router;

var getData = function(user, pass, res) {
    basicRequest(user, pass, res);
};

var basicRequest = function(user, pass, res) {
    var self = this;
    self.res = res;
    var request = require('request');

    var options = {
        url: 'https://api.resourceguruapp.com/v1/buildingblocks/resources/me',
        auth: {
            username: user,
            password: pass
        }
    };


    //get the resource id of the person /resources/me
    //use that id to get the bookings /resources/id/bookings
    //return the json here and then parse it later

    return request(options, function(err, res, body) {

        var options = {
            url: 'https://api.resourceguruapp.com/v1/buildingblocks/resources/' + JSON.parse(body).id + '/bookings',
            auth: {
                username: user,
                password: pass
            }
        };
        request(options, function(err, res, body) {
            console.log(options.url);
            self.res.send(JSON.stringify(JSON.parse(body), 0, 4));
        });
    });
};


var oauthRequest = function(user, pass) {

    var oauth2 = require('simple-oauth2')({
        clientID: 'd9ee7e5d9ad648f92276962dc309b04479807de02b2ce2ed3195d4655578ef10',
        clientSecret: 'd32588d5c8742bf050fbd12a9a0f9bb041cf92e2f5f0df649a7a8c2f743a6558',
        site: 'https://api.resourceguruapp.com/oauth/token',
        tokenPath: 'https://api.resourceguruapp.com/oauth/token'
    });

    console.log(oauth2);
// Get the access token object.
    var token;
    oauth2.password.getToken({
        username: user,
        password: pass
    }, saveToken);

// Save the access token
    function saveToken(error, result) {
        if (error) { console.log('Access Token Error', error.message); }
        token = oauth2.accessToken.create(result);

        oauth2.api('GET', '/users', {
            access_token: token.token.access_token
        }, function (err, data) {
            console.log(data);
        });
    }
}

