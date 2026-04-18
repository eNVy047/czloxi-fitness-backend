import { FastifyInstance } from 'fastify';
import { SubscriptionController } from './subscription.controller';

export default async function subscriptionRoutes(app: FastifyInstance) {
  // All routes are protected by app.authenticate (managed in app.ts)
  app.addHook('onRequest', app.authenticate);

  app.get('/status', SubscriptionController.getStatus);
  app.post('/start-trial', SubscriptionController.startTrial);
  app.post('/check-scan-limit', SubscriptionController.checkScanLimit);
}
