var exports = module.exports = {};

var fs = require('fs');

exports.settings;

exports.setup = function() {
    var data = fs.readFileSync('./config.json');

    try{
        exports.settings = JSON.parse(data);
        setupFinished = true;
    }
    catch (err) {
        console.log(err);
    }
};