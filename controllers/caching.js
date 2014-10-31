var exports = module.exports = {};

var fs = require('fs');

exports.cacheDataToFile = function(data, filename) {
	fs.writeFileSync('data/' + filename, JSON.stringify(data));
  	console.log('saved ' + filename + ' to disk for caching');
}
