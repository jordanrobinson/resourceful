var exports = module.exports = {};

var request = require('request');

var caching = require('../controllers/caching.js'),
config = require('../controllers/config.js'),
resources = require('../controllers/resources.js');

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
	options.url = 'https://api.resourceguruapp.com/v1/buildingblocks/clients?limit=0',
	request(options, function(err, res, body) {
		body = JSON.parse(body);
		caching.cacheDataToFile(body, 'clients.json');
		resources.clients = body;
	});
}

exports.updateProjects = function() {
	checkSetup();
	options.url = 'https://api.resourceguruapp.com/v1/buildingblocks/projects?limit=0',
	request(options, function(err, res, body) {
		body = JSON.parse(body);
		caching.cacheDataToFile(body, 'projects.json');
		resources.projects = body;
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
