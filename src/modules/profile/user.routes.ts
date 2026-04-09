import { FastifyInstance } from 'fastify';
import { UserController } from './user.controller';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  
  fastify.patch('/fcm-token', UserController.saveFcmToken);
  fastify.delete('/fcm-token', UserController.removeFcmToken);
}
