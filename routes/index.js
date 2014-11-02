var express = require('express'),
request = require('request'),
moment = require('moment'),
fs = require('fs'),
jsdiff = require('diff');

var caching = require('../controllers/caching.js'),
config = require('../controllers/config.js'),
comparison = require('../controllers/comparison.js'),
updates = require('../controllers/updates.js'),
resources = require('../controllers/resources.js');

var router = express.Router();

var firstRenderFinished = false;
var getDataInterval = 1000 * 60;// * 60;
var previousBookings;


/* GET index page. */
router.get('/', function(req, res) {

    if (!config.settings) {
        config.setup();
    }

    if (req.params.name !== undefined && req.params.pass !== undefined) {
        res.render('index', {title: 'success'});
    }
    else {
        res.render('index', { title: 'Auth' });
    }
});

router.post('/', function(req, res) {
    console.log('starting updates...');
    if (fs.existsSync('data/clients.json')) {
        resources.clients = JSON.parse(fs.readFileSync('data/clients.json'));
    } else {
        updates.updateClients();
    }

    if (fs.existsSync('data/projects.json')) {
        resources.projects = JSON.parse(fs.readFileSync('data/projects.json'));
    } else {
       updates.updateProjects();
    }

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
            parseData(JSON.parse(body), self.res);
        });
    });
};

var parseData = function(bookings, res) {

    if (!firstRenderFinished) {

        //parse clients
        for (var i = 0; i < bookings.length; i++) {
            for (var j = 0; j < resources.clients.length; j++) {
                if (bookings[i].client_id === resources.clients[j].id) {
                    bookings[i].client_id = resources.clients[j].name;
                    bookings[i].client_colour = resources.clients[j].color;
                    break;
                }
            }
        }

        //parse projects
        for (var i = 0; i < bookings.length; i++) {
            for (var j = 0; j < resources.projects.length; j++) {
                if (bookings[i].project_id === resources.projects[j].id) {
                    bookings[i].project_id = resources.projects[j].name;
                    bookings[i].project_colour = resources.projects[j].color;
                    break;
                }
            }
        }

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


