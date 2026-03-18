import { FastifyInstance } from 'fastify';
import { PaymentController } from './payment.controller';

export default async function paymentRoutes(fastify: FastifyInstance) {
  // All routes are protected by fastify.authenticate (registered in app.ts)
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post('/create-order', PaymentController.createOrder);
  fastify.post('/verify', PaymentController.verifyPayment);
  fastify.get('/status', PaymentController.getStatus);
  fastify.get('/history', PaymentController.getHistory);
  fastify.post('/start-trial', PaymentController.startTrial);
}
