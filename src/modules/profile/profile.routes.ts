import { FastifyInstance } from 'fastify';
import { ProfileController } from './profile.controller';

export default async function profileRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.post('/setup', ProfileController.setup);
  fastify.get('/', ProfileController.getProfile);
  fastify.get('/goals', ProfileController.getGoals);
  fastify.put('/update', ProfileController.updateProfile);
  fastify.post('/image', ProfileController.uploadProfileImage);
  fastify.delete('/delete', ProfileController.deleteAccount);
}
