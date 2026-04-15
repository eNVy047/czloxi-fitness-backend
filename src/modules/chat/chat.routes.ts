import { FastifyInstance } from 'fastify';
import { ChatController } from './chat.controller';
import { subscriptionGuard } from '../payment/subscriptionGuard';

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.post('/', {
    preHandler: [fastify.authenticate, subscriptionGuard],
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          history: { 
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['user', 'ai'] },
                text: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, ChatController.message);
}
