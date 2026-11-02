import amqp from 'amqplib';

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isMissingResource(error) {
  return error?.code === 404 || error?.replyCode === 404;
}

export class RabbitAdminService {
  constructor(url, managementUrl) {
    this.url = url;
    const amqpUrl = new URL(url);
    this.vhost = decodeURIComponent(amqpUrl.pathname.slice(1) || '/');
    this.managementBaseUrl = this.resolveManagementUrl(amqpUrl, managementUrl);
    this.managementAuthorization = this.createManagementAuthorization(amqpUrl);
    this.connection = null;
    this.connectionPromise = null;
    this.channel = null;
    this.channelPromise = null;
  }

  async getConnection() {
    if (this.connection) {
      return this.connection;
    }
    if (!this.connectionPromise) {
      this.connectionPromise = amqp.connect(this.url)
        .then((connection) => {
          this.connection = connection;
          connection.on('close', () => this.invalidateConnection(connection));
          connection.on('error', () => this.invalidateConnection(connection));
          return connection;
        })
        .catch((error) => {
          this.connectionPromise = null;
          throw error;
        });
    }
    return this.connectionPromise;
  }

  async getChannel() {
    if (this.channel) {
      return this.channel;
    }
    if (!this.channelPromise) {
      this.channelPromise = this.getConnection()
        .then((connection) => connection.createChannel())
        .then((channel) => {
          this.channel = channel;
          channel.on('close', () => this.invalidateChannel(channel));
          channel.on('error', () => this.invalidateChannel(channel));
          return channel;
        })
        .catch((error) => {
          this.channelPromise = null;
          throw error;
        });
    }
    return this.channelPromise;
  }

  async assertQueue(input) {
    return this.runChannel((channel) => channel.assertQueue(input.queue, { durable: input.durable }));
  }

  async deleteQueue(queue) {
    return this.runChannel((channel) => channel.deleteQueue(queue), 'La cola no existe.');
  }

  async getQueue(queue) {
    return this.runChannel((channel) => channel.checkQueue(queue), 'La cola no existe.');
  }

  async listQueues() {
    const queues = await this.managementRequest('queues');
    return queues.map(({ name, vhost, durable, auto_delete, messages, consumers }) => ({
      name, vhost, durable, auto_delete, messages, consumers
    }));
  }

  async assertExchange(input) {
    return this.runChannel((channel) => channel.assertExchange(
      input.exchange,
      input.type,
      { durable: input.durable }
    ));
  }

  async deleteExchange(exchange) {
    return this.runChannel((channel) => channel.deleteExchange(exchange), 'El exchange no existe.');
  }

  async listExchanges() {
    const exchanges = await this.managementRequest('exchanges');
    return exchanges.map(({ name, vhost, type, durable, auto_delete, internal }) => ({
      name, vhost, type, durable, auto_delete, internal
    }));
  }

  async bindQueue(input) {
    return this.runChannel(
      (channel) => channel.bindQueue(input.queue, input.exchange, input.routingKey),
      'La cola o el exchange no existen.'
    );
  }

  async unbindQueue(input) {
    return this.runChannel(
      (channel) => channel.unbindQueue(input.queue, input.exchange, input.routingKey),
      'La cola o el exchange no existen.'
    );
  }

  async close() {
    const channel = this.channel;
    const connection = this.connection;
    this.channel = null;
    this.channelPromise = null;
    this.connection = null;
    this.connectionPromise = null;
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
  }

  async runChannel(operation, notFoundMessage) {
    const channel = await this.getChannel();
    try {
      return await operation(channel);
    } catch (error) {
      if (isMissingResource(error)) {
        this.invalidateChannel(channel);
        throw httpError(404, notFoundMessage || 'El recurso RabbitMQ solicitado no existe.');
      }
      if (error?.code === 406 || error?.replyCode === 406) {
        this.invalidateChannel(channel);
      }
      throw error;
    }
  }

  async managementRequest(resource) {
    const vhost = encodeURIComponent(this.vhost);
    const response = await fetch(`${this.managementBaseUrl}/${resource}/${vhost}`, {
      headers: this.managementAuthorization
        ? { Authorization: this.managementAuthorization }
        : {}
    });
    if (!response.ok) {
      throw httpError(502, `RabbitMQ Management API respondió HTTP ${response.status}.`);
    }
    return response.json();
  }

  invalidateChannel(channel) {
    if (this.channel === channel) {
      this.channel = null;
      this.channelPromise = null;
    }
  }

  invalidateConnection(connection) {
    if (this.connection === connection) {
      this.connection = null;
      this.connectionPromise = null;
      this.channel = null;
      this.channelPromise = null;
    }
  }

  resolveManagementUrl(amqpUrl, managementUrl) {
    const baseUrl = new URL(managementUrl || amqpUrl);
    if (!managementUrl) {
      baseUrl.protocol = amqpUrl.protocol === 'amqps:' ? 'https:' : 'http:';
      baseUrl.port = amqpUrl.protocol === 'amqps:' ? '15671' : '15672';
    }
    baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, '')}/api`;
    baseUrl.search = '';
    baseUrl.hash = '';
    return baseUrl.toString().replace(/\/$/, '');
  }

  createManagementAuthorization(amqpUrl) {
    if (!amqpUrl.username && !amqpUrl.password) {
      return null;
    }
    const username = decodeURIComponent(amqpUrl.username);
    const password = decodeURIComponent(amqpUrl.password);
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }
}
