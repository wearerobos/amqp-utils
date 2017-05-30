module.exports = (amqp) => {
  const channelPromise = amqp
    .connect(process.env.AMQP_URL)
    .then(connection => connection.createChannel());

  return {
    subscribe,
    publish,
    rpc,
  };

  function subscribe(queue, callback) {
    channelPromise
      .then(channel => channel.assertQueue(queue, { durable: true })
      .then(() => channel.consume(queue, (msg) => {
        callback(JSON.parse(msg.content));
        channel.ack(msg);
      }, { noAck: false })));
  }

  function publish(queue, data = '') {
    channelPromise
      .then(channel => channel.assertQueue(queue, { durable: true })
      .then(() => channel.sendToQueue(queue, createBufferFromData(data))));
  }

  /**
   * Use this method when you have a client that sends a message and needs to wait for the response and can't have
   * other client having the response, ie. a remote procedure call.
   * For more info, check https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html
   * @param  {String}   queue     The name of the queue to which the client must send the message
   * @param  {Any}   [data=''] The data that will be sent to the message queue. Can be any object.
   * @param  {Function} callback  The function that will be executed when the remote procedure call's response comes
   */
  function rpc({ queue, data = '', callback }) {
    channelPromise
      .then(channel => channel.assertQueue('', { exclusive: true })
      .then((q) => {
        const correlationId = `${new Date().getUTCMilliseconds()}${Math.random()}`;

        channel.consume(q.queue, (msg) => {
          if (msg.properties.correlationId === correlationId) {
            callback(JSON.parse(msg.content));
          }
        }, { noAck: true });

        channel.sendToQueue(queue, createBufferFromData(data), {
          correlationId,
          replyTo: q.queue,
        });
      }));
  }
};

function createBufferFromData(data) {
  return Buffer.from(JSON.stringify(data));
}
