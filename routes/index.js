var express = require('express'),
request = require('request'),
moment = require('moment'),
fs = require('fs'),
jsdiff = require('diff');

var caching = require('../controllers/caching.js'),
config = require('../controllers/config.js'),
comparison = require('../controllers/comparison.js'),
updates = require('../controllers/updates.js'),
resources = require('../controllers/resources.js'),
email = require('../controllers/email.js');

var router = express.Router();

var firstRenderFinished = false;
var getDataInterval = 1000 * 60;// * 60;
var previousBookings;

var runningTasks = {};

/* GET index page. */
router.get('/', function(req, res) {

    if (!config.settings) {
        config.setup();
    }

    res.render('index');
});

router.post('/', function(req, res) {

    var rgUsername = req.body.rgUsername;
    var rgPassword = config.settings.rgPassword;
    var mailUsername = config.settings.mailUsername;

    console.log(rgUsername);
    
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

    console.log('starting updates for ' + rgUsername);
    getData(rgUsername, rgPassword, mailUsername, res);

    runningTasks[rgUsername] = setInterval(getData, getDataInterval, rgUsername, rgPassword, mailUsername, res);
    email.subscribe(mailUsername);
    res.render('success');
});

router.post('/unsubscribe', function(req, res) {
    var rgUsername = config.settings.rgUsername;
    var rgPassword = config.settings.rgPassword;
    var mailUsername = config.settings.mailUsername;

    clearInterval(runningTasks[rgUsername]);
    console.log('unsubscribing ' + rgUsername);
    email.unsubscribe(mailUsername);
    res.render('unsubscribed');
});

module.exports = router;

var getData = function(user, pass, email, res) {
    console.log('hitting getData ' + new Date().toString());
    if (updates.update) {
        basicRequest(user, pass, email, res);
    }
    else {
        console.log('Polling currently off.');
    }
};

var basicRequest = function(user, pass, email, res) {
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
            parseData(JSON.parse(body), email, self.res);
        });
    });
};

var parseData = function(bookings, email, res) {

    var userdir = email.replace(/\./g, '');
    userdir = userdir.replace('@', '-');
    userdir = 'data/' + userdir;

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

        caching.cacheDataToFile(bookings, userdir, 'bookings.json');
        firstRenderFinished = true;
    }
    else {
        caching.cacheDataToFile(bookings, userdir, 'current.json');

        currentBookings = fs.readFileSync(userdir + '/current.json', {encoding: 'utf8'});
        previousBookings = fs.readFileSync(userdir + '/bookings.json', {encoding: 'utf8'});

        comparison.compareAgainstPrevious(currentBookings, previousBookings, email);
    }
}


