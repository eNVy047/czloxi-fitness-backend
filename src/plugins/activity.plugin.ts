import { FastifyInstance } from 'fastify';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export default async function activityPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request) => {
    try {
      // Check if user is authenticated (populated by authPlugin)
      if (request.user && request.user.id) {
        // Asynchronously update lastActiveAt without blocking the request
        User.findByIdAndUpdate(request.user.id, {
          lastActiveAt: new Date(),
        }).catch((err) => {
          logger.error({ err, userId: request.user.id }, 'Error updating lastActiveAt');
        });
      }
    } catch (error) {
      // Ignore errors in activity tracking to avoid breaking the main request flow
    }
  });
}
