import amqp from 'amqplib';

export class RabbitAdminService {
  constructor(url) {
    this.url = url;
    this.connection = null;
    this.channel = null;
  }

  async getChannel() {
    if (!this.channel) {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
    }
    return this.channel;
  }

  async assertQueue(input) {
    return this.getChannel().then((channel) => channel.assertQueue(input.queue, { durable: input.durable }));
  }

  async deleteQueue(queue) {
    return this.getChannel().then((channel) => channel.deleteQueue(queue));
  }

  async getQueue(queue) {
    return this.getChannel().then((channel) => channel.checkQueue(queue));
  }

  async assertExchange(input) {
    return this.getChannel().then((channel) => channel.assertExchange(input.exchange, input.type, { durable: input.durable }));
  }

  async deleteExchange(exchange) {
    return this.getChannel().then((channel) => channel.deleteExchange(exchange));
  }

  async bindQueue(input) {
    return this.getChannel().then((channel) => channel.bindQueue(input.queue, input.exchange, input.routingKey));
  }

  async unbindQueue(input) {
    return this.getChannel().then((channel) => channel.unbindQueue(input.queue, input.exchange, input.routingKey));
  }

  async close() {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }
}
