import { FastifyInstance } from 'fastify';
import { ProfileController } from './profile.controller';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  
  fastify.post('/fcm-token', ProfileController.saveFcmToken);
  fastify.delete('/fcm-token', ProfileController.removeFcmToken);
}
