var exports = module.exports = {};

var caching = require('../controllers/caching.js');

var fs = require('fs')
jsdiff = require('diff');

exports.compareAgainstPrevious = function(currentBookings, previousBookings) {
	if (currentBookings === previousBookings) {
		console.log('match!');
	}
	else {
		console.log('different!');
		caching.cacheDataToFile(JSON.parse(currentBookings), 'bookings.json');
	}

	// var diff = jsdiff.diffWords(currentBookings, previousBookings);
	// console.log(diff.length);

	// diff.forEach(function(part){
 //  var color = part.added ? 'green' :
 //  part.removed ? 'red' : 'grey';
 //  process.stderr.write(part.value[color]);
	// });

	// if (diff) {
	// 	console.log('looks the same as an hour ago');
	// }
	// else {
	// 	console.log('different D:');
	// 	previousBookings = bookings;
	// }
}