import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { requireAdmin } from './auth.js';
import { env } from './env.js';
import { RabbitAdminService } from './rabbit-admin.service.js';
import { validateBindingBody, validateExchangeBody, validateName, validateQueueBody } from './validation.js';

export function createApp(service = new RabbitAdminService(env.rabbitUrl), authMiddleware = requireAdmin) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.frontendOrigin }));
  app.use(express.json());
  app.use(authMiddleware);

  const execute = (operation) => async (req, res, next) => {
    try {
      const result = await operation(req);
      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  app.post('/queues', execute((req) => service.assertQueue(validateQueueBody(req.body))));
  app.get('/queues/:queue', execute((req) => service.getQueue(validateName(req.params.queue, 'queue'))));
  app.delete('/queues/:queue', execute((req) => service.deleteQueue(validateName(req.params.queue, 'queue'))));
  app.post('/exchanges', execute((req) => service.assertExchange(validateExchangeBody(req.body))));
  app.delete('/exchanges/:exchange', execute((req) => service.deleteExchange(validateName(req.params.exchange, 'exchange'))));
  app.post('/bindings', execute((req) => service.bindQueue(validateBindingBody(req.body))));
  app.delete('/bindings', execute((req) => service.unbindQueue(validateBindingBody(req.body))));

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Error interno de Rabbit-admin.' });
  });
  return app;
}
