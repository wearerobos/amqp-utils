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

  it.skip('subscribe() calls amqp\'s consume()', () => {
    const callback = jest.fn();

    const createChannel = jest.fn(() => ({
      assertQueue() {

      },
      consume() {
        callback();
      },
    }));
    const amqpImplementationMock = {
      connect: jest.fn(() =>
        Promise.resolve({ createChannel })
      ),
    };

    const amqputils = AMQPUtils(amqpImplementationMock);
    amqputils.subscribe('some.queue', callback);
    expect(callback).resolves().toHaveBeenCalled();
  });

  it.skip('publish() calls amqp\'s sendToQueue()', () => {});
  it.skip('request() calls amqp\'s sendToQueue() and consumes a unique queue to then run the callback', () => {});
  it.skip(`reply() calls amqp's consume() and calls sendToQueue using the original message's replyTo property
      as the queue's name`, () => {});
});
