var exports = module.exports = {};

var caching = require('../controllers/caching.js')
email = require('../controllers/email.js');

var fs = require('fs'),
jsdiff = require('diff'),
moment = require('moment');

exports.compareAgainstPrevious = function(currentBookings, previousBookings, emailAddress) {
	if (currentBookings === previousBookings) {
		console.log(moment(new Date()).format('YYYY-MM-DD-HH:mm:ss') + ' - comparison for ' + emailAddress + ' resulted in a match.');
	}
	else {
	    var userdir = emailAddress.replace(/\./g, '');
	    userdir = userdir.replace('@', '-');
	    userdir = 'data/' + userdir;

		console.log(moment(new Date()).format('YYYY-MM-DD-HH:mm:ss') + ' - comparison for ' + emailAddress + ' resulted in a diff.');
		caching.cacheDataToFile(JSON.parse(currentBookings), userdir, 'bookings.json');
		email.alert(emailAddress)
	}
}