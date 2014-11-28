var exports = module.exports = {};

var caching = require('../controllers/caching.js')
email = require('../controllers/email.js');

var fs = require('fs')
jsdiff = require('diff');

exports.compareAgainstPrevious = function(currentBookings, previousBookings, emailAddress) {
	if (currentBookings === previousBookings) {
		console.log(new Date().toString() + ' - comparison for ' + emailAddress + ' resulted in a match.');
	}
	else {
	    var userdir = emailAddress.replace(/\./g, '');
	    userdir = userdir.replace('@', '-');
	    userdir = 'data/' + userdir;

		console.log(new Date().toString() + ' - comparison for ' + emailAddress + ' resulted in a diff.');
		caching.cacheDataToFile(JSON.parse(currentBookings), userdir, 'bookings.json');
		email.alert(emailAddress)
	}
}