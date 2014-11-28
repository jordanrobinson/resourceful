var exports = module.exports = {};

var fs = require('fs'),
mkdirp = require('mkdirp');

exports.cacheDataToFile = function(data, dir, filename) {
	
	mkdirp(dir);

	fs.writeFileSync(dir + '/' + filename, JSON.stringify(data));
  	console.log('saved ' + dir + '/' + filename + ' to disk for caching');
}
