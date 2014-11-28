var exports = module.exports = {};
var request = require('request');
var nodemailer = require('nodemailer');
var fs = require('fs');
var setupFinished = false;
var settings, transporter;

exports.alert = function(emailAddress) {
	setup();
	mail(constructBody(), emailAddress);
}

var setup = function() {
	var data = fs.readFileSync('./config.json');
	try{
		settings = JSON.parse(data);
		setupFinished = true;
	}
	catch (err) { 
		console.log(err);
	}

	transporter = nodemailer.createTransport({ //would be better as singleton
		service: 'Gmail',
		debug: true,
		auth: {
			user: settings.mailUsername,
			pass: settings.mailPassword
		}
	});

	}

var constructBody = function() {
	//do stuff here

	return '<i>test email :D</i>'
}

var mail = function(body, destination) {

	var mailOptions = {
		from: 'test person',
		to: destination,
		subject: 'Resource Guru Notification',
		text: body,
		html: body
	};

	transporter.sendMail(mailOptions, function(error, info){
		console.log('sending mail to ' + destination);
		if (error) {
			console.log(error);
		}
		else {
			console.log('Message sent: ' + info.response);
		}
	});
};