var express = require('express'), 
router = express.Router();

var updates = require('../controllers/updates.js');

router.post('/', function(req, res) {
	if (req.query.method === 'start') {
		updates.update = true;
	}
	else if (req.query.method === 'stop') {
		updates.update = false;
	}
});

module.exports = router; 
