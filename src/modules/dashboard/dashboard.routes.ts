import { FastifyInstance } from 'fastify';
import { DashboardController } from './dashboard.controller';
import { subscriptionGuard } from '../payment/subscriptionGuard';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('preHandler', subscriptionGuard);

  fastify.get('/today', DashboardController.getTodayLog);
  fastify.get('/day', DashboardController.getDayLog);
  fastify.get('/week', DashboardController.getWeekLogs);
  fastify.patch('/water', DashboardController.addWaterGlass);
}

