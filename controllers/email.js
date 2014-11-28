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

exports.unsubscribe = function(emailAddress) {
	setup();
	mail(constructUnsubscribeBody(), emailAddress);
}

exports.subscribe = function(emailAddress) {
	setup();
	mail(constructSubscribeBody(), emailAddress);
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
	return fs.readFileSync('templates/alert.html', {encoding: 'utf8'});
}

var constructUnsubscribeBody = function() {
	return fs.readFileSync('templates/unsubscribed.html', {encoding: 'utf8'});
}

var constructSubscribeBody = function() {
	return fs.readFileSync('templates/subscribed.html', {encoding: 'utf8'});
}

var mail = function(body, destination) {

	var mailOptions = {
		from: 'Resourceful',
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