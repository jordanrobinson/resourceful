var express = require('express');
var router = express.Router();
var request = require('request');

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
    setTimeout(basicRequest(user, pass, res), 1000 * 60 * 60);
};

var update = function(user, pass, res) {
    basicRequest(user, pass, res);
    setTimeout(update(user, pass, res), 1000 * 60 * 60);
}

var basicRequest = function(user, pass, res) {
    var self = this;
    self.res = res;


    var options = {
        url: 'https://api.resourceguruapp.com/v1/buildingblocks/resources/me',
        auth: {
            username: 'j.robinson@building-blocks.com', //user,
            password: ''                     //pass
        }
    };

    //get the resource id of the person /resources/me
    //use that id to get the bookings /resources/id/bookings
    //return the json here and then parse it later

    return request(options, function(err, res, body) {

        var startDate = '2014-10-01';
        var endDate = '2014-10-21';

        var options = {
            url: 'https://api.resourceguruapp.com/v1/buildingblocks/resources/' + JSON.parse(body).id + '/bookings?' +
                'start_date=' + startDate + 'end_date=' + endDate,
            auth: {
                username: 'j.robinson@building-blocks.com', //user,
                password: '.'                     //pass
            }
        };
        request(options, function(err, res, body) {
            getClients(err, self.res, body, options);
        });
    });
};

var getClients = function(err, res, body, options) {
    var bookings = JSON.parse(body);
    var self = this;
    self.res = res;
    options.url = 'https://api.resourceguruapp.com/v1/buildingblocks/clients',
        request(options, function(err, res, body) {
            body = JSON.parse(body);

            for (var i = 0; i < bookings.length; i++) {
                console.log(bookings[i].client_id);
                for (var j = 0; j < body.length; j++) {
                    console.log(body[j].id);
                    if (bookings[i].client_id === body[j].id) {
                        bookings[i].client_id = body[j].name;
                        bookings[i].colour = body[j].color;
                        break;
                    }
                }
            }
            parseData(bookings, body, self.res);
        });
}

var parseData = function(bookings, clients, res) {

    //bookings = JSON.parse(bookings);

    res.render('schedule', { bookings: bookings });
}


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

