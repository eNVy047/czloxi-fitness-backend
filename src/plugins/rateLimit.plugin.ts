import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { redis } from '../config/redis';

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    redis: redis,
    nameSpace: 'caloxi-rate-limit-',
    allowList: ['127.0.0.1'], // Optional: whitelist local IP
    errorResponseBuilder: (_request, context) => {
      return {
        success: false,
        message: `Rate limit exceeded. Try again in ${context.after}`,
      };
    },
  });
});
