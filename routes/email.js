var express = require('express');
var router = express.Router(); 
var request = require('request');
var nodemailer = require('nodemailer');
var fs = require('fs');
var setupFinished = false;
var settings, transporter;

router.post('/', function(req, res) {
	if (!setupFinished) {
		setup();
	}
	mail(settings.mailUsername, req, constructBody());
	res.send('success!');
});

module.exports = router;

var setup = function() {
	var data = fs.readFileSync('./config.json');

		transporter = nodemailer.createTransport({ //would be better as singleton
			service: 'Gmail',
			debug: true,
			auth: {
				user: settings.mailUsername,
				pass: settings.mailPassword
			}
		});

		try{
			settings = JSON.parse(data);
			setupFinished = true;
		}
		catch (err) {
			console.log(err);
		}
	}

	var constructBody = function() {
	//do stuff here

	return '<i>test email :D</i>'
}

var mail = function(destination, req, body) {

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