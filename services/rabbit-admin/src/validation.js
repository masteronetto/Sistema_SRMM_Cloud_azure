const namePattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,254}$/;
const exchangeTypes = new Set(['direct', 'fanout', 'topic', 'headers']);

export function validateName(value, field) {
  if (typeof value !== 'string' || !namePattern.test(value)) {
    const error = new Error(`${field} debe contener entre 1 y 255 caracteres validos.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

export function validateExchangeType(value) {
  if (!exchangeTypes.has(value)) {
    const error = new Error('type debe ser direct, fanout, topic o headers.');
    error.statusCode = 400;
    throw error;
  }
  return value;
}

export function validateQueueBody(body = {}) {
  return { queue: validateName(body.queue, 'queue'), durable: body.durable !== false };
}

export function validateExchangeBody(body = {}) {
  return {
    exchange: validateName(body.exchange, 'exchange'),
    type: validateExchangeType(body.type || 'topic'),
    durable: body.durable !== false
  };
}

export function validateBindingBody(body = {}) {
  return {
    exchange: validateName(body.exchange, 'exchange'),
    queue: validateName(body.queue, 'queue'),
    routingKey: validateName(body.routingKey || '#', 'routingKey')
  };
}
