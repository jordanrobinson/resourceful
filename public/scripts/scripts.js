var showUnsubscribe = function() {
	$('unsubscribe-box').removeClass('visually-hidden');
}

var validate = function() {
	if ($('rgUsername').value == '' ||
		$('rgPassword').value == '' ||
		$('email').value == '') {
		console.log('letting you off this time...');
	}
}

$(document).ready(function() {
	$('submit').click(validate());
});

var validator = new FormValidator('subscribe', [{
    name: 'rgUsername',
    display: 'required',
    rules: 'required'
}, {
    name: 'rgPassword',
    display: 'required',
    rules: 'required'
}, {
	name: 'email',
	display: 'required',
    rules: 'required'
}], function(errors, event) {
    if (errors.length > 0) {
    	console.log('required stuff D:');
    }
});

$(document).ready(function() {
	$('#unsubscribe-link').bind('click',
		function() {
			$('#unsubscribeBox').slideToggle('slow');
			$('#subscribeBox').slideToggle('slow');
		});
});
