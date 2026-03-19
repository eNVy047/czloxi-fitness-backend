import { FastifyInstance } from 'fastify';
import { ActivityController } from './activity.controller';
import { subscriptionGuard } from '../payment/subscriptionGuard';

export default async function activityRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('preHandler', subscriptionGuard);

  fastify.get('/today', ActivityController.getTodayActivity);
  fastify.get('/log', ActivityController.getActivityLog);
  fastify.patch('/steps', ActivityController.updateSteps);
  fastify.post('/exercise', ActivityController.logExercise);
  fastify.delete('/exercise/:id', ActivityController.deleteExercise);
  fastify.get('/library', ActivityController.getLibrary);

  // Sleep & Routine
  fastify.post('/sleep', ActivityController.logSleep);
  fastify.get('/routine', ActivityController.getRoutine);
  fastify.put('/routine/:id', ActivityController.updateRoutine);
  fastify.delete('/routine/:id', ActivityController.deleteRoutine);
  // Daily Checkin
  fastify.patch('/workout-checkin', ActivityController.workoutCheckin);
}

