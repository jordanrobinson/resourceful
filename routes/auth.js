var express = require('express'),
request = require('request'),
moment = require('moment'),
fs = require('fs'),
jsdiff = require('diff');

var caching = require('../controllers/caching.js'),
config = require('../controllers/config.js'),
comparison = require('../controllers/comparison.js');

var router = express.Router();

var firstRenderFinished = false;
var getDataInterval = (15000);// * 60);// * 60;
var previousBookings;


/* GET auth page. */
router.get('/', function(req, res) {

    if (!config.settings) {
        config.setup(); //export to a config class
    }

    if (req.params.name !== undefined && req.params.pass !== undefined) {
        res.render('index', {title: 'success'});
    }
    else {
        res.render('auth', { title: 'Auth' });
    }
});

router.post('/', function(req, res) {
    getData(config.settings.rgUsername, config.settings.rgPassword, res);
    setInterval(getData, getDataInterval, config.settings.rgUsername, config.settings.rgPassword, res);
});

module.exports = router;

var getData = function(user, pass, res) {
    console.log('hitting getData ' + new Date().toString());
    basicRequest(user, pass, res);
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

    if (!firstRenderFinished) {
        res.render('schedule', { bookings: bookings });

        caching.cacheDataToFile(bookings, 'bookings.json');
        firstRenderFinished = true;
    }
    else {
        caching.cacheDataToFile(bookings, 'current.json');

        currentBookings = fs.readFileSync('data/current.json', {encoding: 'utf8'});
        previousBookings = fs.readFileSync('data/bookings.json', {encoding: 'utf8'});
        
        comparison.compareAgainstPrevious(currentBookings, previousBookings);
    }
}


