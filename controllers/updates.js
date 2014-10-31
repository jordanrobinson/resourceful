var exports = module.exports = {};

var request = require('request');

var caching = require('../controllers/caching.js'),
config = require('../controllers/config.js');

var oneHour = (((1000 * 60) * 60) * 60),
options = config.rgOptions;

var checkSetup = function() {
	if (!options) {
		config.setup();
		options = config.rgOptions
	}
}

exports.queueUpdates = function() {
	checkSetup();
	setInterval(updateClients, oneHour);
	setInterval(updateClients, oneHour);
}

exports.updateClients = function() {
	checkSetup();
	options.url = 'https://api.resourceguruapp.com/v1/buildingblocks/clients',
	request(options, function(err, res, body) {
		body = JSON.parse(body);
		caching.cacheDataToFile(body, 'clients.json');
	});
}

exports.updateProjects = function() {
	checkSetup();
	options.url = 'https://api.resourceguruapp.com/v1/buildingblocks/projects',
	request(options, function(err, res, body) {
		body = JSON.parse(body);
		caching.cacheDataToFile(body, 'projects.json');
	});
}

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



exports.getClients = function(err, res, body, options) {
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
