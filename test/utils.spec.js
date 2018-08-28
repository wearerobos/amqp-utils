const AMQPUtils = require('../lib');

describe('AMQP-Utils', () => {
  it('Connects and creates a new channel on initialization', () => {
    process.env.AMQP_URL = 3000;

    const createChannel = jest.fn();
    const amqpImplementationMock = {
      connect: jest.fn(() =>
        Promise.resolve({ createChannel })
      ),
    };

    AMQPUtils(amqpImplementationMock);

    expect(amqpImplementationMock.connect).toHaveBeenCalledWith('3000');
  });

  it('subscribe() calls amqp\'s consume()', () => {
    const callback = jest.fn();

    const channel = {
      assertQueue: () => Promise.resolve(),
      consume: jest.fn(() => {
        callback();
      }),
    };

    const amqpImplementationMock = {
      connect: () => Promise.resolve({
        createChannel: () => Promise.resolve(channel),
      }),
    };

    const amqputils = AMQPUtils(amqpImplementationMock);
    return amqputils
      .subscribe('some.queue', callback)
      .then(() => {
        expect(channel.consume).toHaveBeenCalled();
        expect(channel.consume.mock.calls[0][0]).toEqual('some.queue');
        expect(callback).toHaveBeenCalled();
      });
  });

  it('publish() calls amqp\'s sendToQueue()', () => {
    const channel = {
      assertQueue: () => Promise.resolve(),
      sendToQueue: jest.fn(),
    };

    const amqpImplementationMock = {
      connect: () => Promise.resolve({
        createChannel: () => Promise.resolve(channel),
      }),
    };

    const amqp = AMQPUtils(amqpImplementationMock);

    return amqp
      .publish('my_queue')
      .then(() => {
        expect(channel.sendToQueue).toHaveBeenCalled();
        expect(channel.sendToQueue.mock.calls[0][0]).toEqual('my_queue');
      });
  });
  it('request() calls amqp\'s sendToQueue() and consumes a unique queue to then run the callback', () => {
    const channel = {
      assertQueue: () => Promise.resolve({ queue: 'auto_generated_queue_name' }),
      sendToQueue: jest.fn(),
      consume: jest.fn(),
    };

    const amqpImplementationMock = {
      connect: () => Promise.resolve({
        createChannel: () => Promise.resolve(channel),
      }),
    };

    const amqp = AMQPUtils(amqpImplementationMock);

    return amqp
      .request({ queue: 'my_queue', callback: () => {} })
      .then(() => {
        expect(channel.consume).toHaveBeenCalled();
        expect(channel.sendToQueue).toHaveBeenCalled();
        expect(channel.sendToQueue.mock.calls[0][0]).toEqual('my_queue');
      });
  });
  it(`reply() calls amqp's consume() and calls sendToQueue using the original message's replyTo property
      as the queue's name`, () => {
    const channel = {
      prefetch() {},
      assertQueue() {},
      consume: jest.fn((queue, callback) => {
        callback({
          properties: {
            replyTo: 'reply_to_queue',
            correlationId: 54123,
          },
        });
      }),
      sendToQueue: jest.fn(),
      ack: jest.fn(),
    };

    const amqpImplementationMock = {
      connect: () => Promise.resolve({
        createChannel: () => Promise.resolve(channel),
      }),
    };

    const mockData = { hello: 'howareyou' };

    const callback = jest.fn(() => Promise.resolve(mockData));

    const amqp = AMQPUtils(amqpImplementationMock);

    return amqp
      .reply('my_queue', callback)
      .then(() => {
        expect(channel.consume).toHaveBeenCalled();
        expect(channel.consume.mock.calls[0][0]).toEqual('my_queue');

        expect(callback).toHaveBeenCalled();

        expect(channel.sendToQueue).toHaveBeenCalled();
        expect(channel.sendToQueue.mock.calls[0][0]).toEqual('reply_to_queue');
        expect(channel.sendToQueue.mock.calls[0][2]).toEqual({ correlationId: 54123 });

        expect(channel.ack).toHaveBeenCalled();
      });
  });
});
