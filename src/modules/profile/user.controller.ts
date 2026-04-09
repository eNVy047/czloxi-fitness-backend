import { FastifyReply, FastifyRequest } from 'fastify';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';

export class UserController {
  /**
   * Save FCM token to user profile
   * Unsets the token from any other accounts to ensure uniqueness per device
   */
  static async saveFcmToken(request: FastifyRequest<{ Body: { fcmToken: string } }>, reply: FastifyReply) {
    try {
      const { fcmToken } = request.body;
      const user = request.user as any;

      if (!user || !user.id) {
        logger.warn('saveFcmToken called without authenticated user');
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
      }

      const userId = user.id;

      if (!fcmToken) {
        return reply.status(400).send({ success: false, message: 'fcmToken is required' });
      }

      // 1. Remove this fcmToken from ALL other users
      // This ensures that the same device token never exists on multiple accounts
      const unsetResult = await User.updateMany(
        { fcmToken, _id: { $ne: userId } },
        { $unset: { fcmToken: "" } }
      );
      
      if (unsetResult.modifiedCount > 0) {
        logger.info({ fcmToken, modifiedCount: unsetResult.modifiedCount }, 'Unset FCM token from existing accounts');
      }

      // 2. Save to current user
      await User.findByIdAndUpdate(userId, { fcmToken });

      return reply.send({ success: true, message: 'FCM token saved successfully' });
    } catch (error) {
      logger.error({ err: error }, 'Error saving FCM token');
      return reply.status(500).send({ success: false, message: 'Internal Server Error' });
    }
  }

  /**
   * Remove FCM token on logout
   */
  static async removeFcmToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user as any;

      if (!user || !user.id) {
        logger.warn('removeFcmToken called without authenticated user');
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
      }

      const userId = user.id;
      
      await User.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      return reply.send({ success: true, message: 'FCM token removed successfully' });
    } catch (error) {
      logger.error({ err: error }, 'Error removing FCM token');
      return reply.status(500).send({ success: false, message: 'Internal Server Error' });
    }
  }
}
