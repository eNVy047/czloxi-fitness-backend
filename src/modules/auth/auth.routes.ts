import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', AuthController.register);
  fastify.post('/login', AuthController.login);
  fastify.post('/logout', { preValidation: [fastify.authenticate] }, AuthController.logout);
  fastify.get('/verify', { preValidation: [fastify.authenticate] }, AuthController.verifyToken);
}
