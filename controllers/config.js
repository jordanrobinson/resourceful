var exports = module.exports = {};

var fs = require('fs');

exports.settings, exports.rgOptions;

exports.setup = function() {
	internalConfig();
	setupMail();
	setupResourceGuru();
};

var internalConfig = function() {
    var data = fs.readFileSync('./config.json');

    try{
        exports.settings = JSON.parse(data);
        setupFinished = true;
    }
    catch (err) {
        console.log(err);
    }
}

var setupResourceGuru = function() {
	exports.rgOptions = {
		url: 'https://api.resourceguruapp.com/v1/buildingblocks/resources/me',
		auth: {
			username: exports.settings.rgUsername,
			password: exports.settings.rgPassword
		}
	};
}

var setupMail = function() {

}
