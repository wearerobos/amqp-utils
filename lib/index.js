const debug = require('debug')('amqp-utils');

module.exports = (amqp) => {
  debug(`Connecting to ${process.env.AMQP_URL}`);
  const channelPromise = amqp
    .connect(process.env.AMQP_URL)
    .then(connection => connection.createChannel())
    .catch(err => debug(`Error while connecting to amqp: ${err.message}`));

  return {
    subscribe,
    publish,
    request,
    reply,
  };

  function subscribe(queue, callback) {
    debug(`Subscribing to ${queue}`);
    return channelPromise
      .then(channel => channel.assertQueue(queue, { durable: true })
      .then(() => channel.consume(queue, (msg) => {
        debug(`Queue ${queue} got a message`);
        callback(JSON.parse(msg.content));
        channel.ack(msg);
      }, { noAck: false })))
      .catch(err => debug(`Error while subscribing to queue ${queue}: ${err.message}`));
  }

  function publish(queue, data = '') {
    debug(`Publishing in queue ${queue}`);
    return channelPromise
      .then(channel => channel.assertQueue(queue, { durable: true })
      .then(() => channel.sendToQueue(queue, createBufferFromData(data))))
      .catch(err => debug(`Error while publishing in queue ${queue}: ${err.message}`));
  }

  /**
   * Use this method when you have a client that sends a message and needs to wait for the response and can't have
   * other client having the response, ie. a remote procedure call.
   * For more info, check https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html
   * @param  {String}   queue     The name of the queue to which the client must send the message
   * @param  {Any}   [data=''] The data that will be sent to the message queue. Can be any object.
   * @param  {Function} callback  The function that will be executed when the remote procedure call's response comes
   */
  function request({ queue, data = '', callback }) {
    debug(`RPC request to ${queue}`);
    return channelPromise
      .then(channel => channel.assertQueue('', { exclusive: true })
        .then((q) => {
          const correlationId = `${new Date().getUTCMilliseconds()}${Math.random()}`;

          channel.consume(q.queue, (msg) => {
            if (msg.properties.correlationId === correlationId) {
              callback(JSON.parse(msg.content));
            }
          }, { noAck: true });
          debug(`RPC will listen to updates in queue ${q.queue}`);

          channel.sendToQueue(queue, createBufferFromData(data), {
            correlationId,
            replyTo: q.queue,
          });
        }))
      .catch(err => debug(`Error in RPC request: ${err.message}`));
  }

  /**
   * Use this method to enable a RPC to happen, then process some data and return it via callback
   * @param  {String}   queue    The name of the queue that will receive the RPC request
   * @param  {Function} callback A function that will be executed before replying the RPC. If you need to send data,
   * return in the callback.
   */
  function reply(queue, callback) {
    return channelPromise
      .then((channel) => {
        channel.prefetch(1);
        channel.assertQueue(queue, { durable: true });
        return channel;
      })
      .then((channel) => {
        debug(`RPC will respond to queue ${queue}`);
        channel.consume(queue, (msg) => {
          callback()
            .then(createBufferFromData)
            .then((data) => {
              channel.sendToQueue(msg.properties.replyTo, data, {
                correlationId: msg.properties.correlationId,
              });
              channel.ack(msg);
            });
        });
      })
      .catch(err => debug(`Error while running callback/sending data: ${err.message}`));
  }
};

function createBufferFromData(data) {
  return Buffer.from(JSON.stringify(data));
}
