var express = require('express');
var router = express.Router();
var request = require('request');
var moment = require('moment');
var fs = require('fs');
var setupFinished = false;
var settings;

/* GET auth page. */
router.get('/', function(req, res) {

    if (!setupFinished) {
        setup(); //export to a config class
    }

    if (req.params.name !== undefined && req.params.pass !== undefined) {
        res.render('index', {title: 'success'});
    }
    else {
        res.render('auth', { title: 'Auth' });
    }
});

router.post('/', function(req, res) {
    getData(settings.rgUsername, settings.rgPassword, res);
});

module.exports = router;


var setup = function() {
    var data = fs.readFileSync('./config.json');

    try{
        settings = JSON.parse(data);
        setupFinished = true;
    }
    catch (err) {
        console.log(err);
    }
};

var getData = function(user, pass, res) {
    console.log('hitting getData');
    setTimeout(basicRequest(user, pass, res), 1000 * 60); //TODO: change to an hour
};



var update = function(user, pass, res) {
    console.log('hitting update');
    basicRequest(user, pass, res);
    setTimeout(update(user, pass, res), 1000 * 60); //TODO: change to an hour
};

var basicRequest = function(user, pass, res) {
    var self = this;
    self.res = res;


    var options = {
        url: 'https://api.resourceguruapp.com/v1/buildingblocks/resources/me',
        auth: {
            username: user,
            password: pass
        }
    };

    return request(options, function(err, res, body) {
        var currentDate = new Date();
        var startDate = moment(currentDate).format('YYYY-MM-DD');
        var endDate = moment(currentDate).add(1, 'month').format('YYYY-MM-DD');

        var options = {
            url: 'https://api.resourceguruapp.com/v1/buildingblocks/resources/' + JSON.parse(body).id + '/bookings?' +
            'start_date=' + startDate + 'end_date=' + endDate,
            auth: {
                username: user,
                password: pass
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
            for (var j = 0; j < body.length; j++) {
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

