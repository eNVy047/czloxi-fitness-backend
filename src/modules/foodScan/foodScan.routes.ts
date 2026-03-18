import { FastifyInstance } from 'fastify';
import { FoodScanController } from './foodScan.controller';
import { subscriptionGuard } from '../payment/subscriptionGuard';

export default async function foodScanRoutes(fastify: FastifyInstance) {
  // All routes are protected
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('preHandler', subscriptionGuard);

  fastify.post('/analyze', FoodScanController.analyzeFood);
  fastify.post('/save', FoodScanController.saveFood);
}

