var exports = module.exports = {};

var fs = require('fs');

exports.clients = null;
exports.projects = null;


exports.update = function(user, pass, res) {
    console.log('hitting update');
    basicRequest(user, pass, res);
    //setTimeout(update(user, pass, res), 1000 * 60); //TODO: change to an hour
};

exports.getClients = function(err, res, body, options) {
    var bookings = JSON.parse(body);

    var self = this;
    self.res = res;
    options.url = 'https://api.resourceguruapp.com/v1/buildingblocks/clients',
    request(options, function(err, res, body) {
        body = JSON.parse(body);

        for (var i = 0; i < bookings.length; i++) {
            for (var j = 0; j < body.length; j++) {
                if (bookings[i].client_id === body[j].id) {
                    bookings[i].client_id = body[j].name;
                    bookings[i].colour = body[j].color;
                    break;
                }
            }
        }
        parseData(bookings, body, self.res);
    });
}