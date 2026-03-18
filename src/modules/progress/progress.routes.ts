import { FastifyInstance } from 'fastify';
import {
  getProgress,
  logSleep,
  logMood,
} from './progress.controller';
import { subscriptionGuard } from '../payment/subscriptionGuard';

export default async function progressRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  app.addHook('preHandler', subscriptionGuard);

  app.get('/', getProgress);
  app.patch('/sleep', logSleep);
  app.patch('/mood', logMood);
}

