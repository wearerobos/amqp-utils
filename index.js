const amqp = require('amqplib');

const utils = require('./lib');

module.exports = utils(amqp);
