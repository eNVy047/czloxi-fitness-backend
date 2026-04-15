import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', AuthController.register);
  fastify.post('/login', AuthController.login);
  fastify.post('/logout', { preValidation: [fastify.authenticate] }, AuthController.logout);
  fastify.get('/verify', { preValidation: [fastify.authenticate] }, AuthController.verifyToken);
  fastify.post('/forgot-password', AuthController.forgotPassword);
  fastify.post('/start-trial', { preValidation: [fastify.authenticate] }, AuthController.startTrial);
}
