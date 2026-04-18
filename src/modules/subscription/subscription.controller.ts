import { FastifyReply, FastifyRequest } from 'fastify';
import { User } from '../../models/User';
import { DailyLog } from '../../models/DailyLog';
import { logger } from '../../utils/logger';
import { sendSuccess, sendError } from '../../utils/response';
import { z } from 'zod';

const startTrialSchema = z.object({
  deviceFingerprint: z.string().min(1),
});

export class SubscriptionController {
  static async startTrial(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: userId } = request.user as { id: string };
      const { deviceFingerprint } = startTrialSchema.parse(request.body);

      const user = await User.findById(userId);
      if (!user) {
        return sendError(reply, 401, 'User not found');
      }

      // 1. Check if user already used trial
      if (user.trialUsed) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Free trial already used', 
          code: 'TRIAL_USED' 
        });
      }

      // 2. Check device fingerprint across ALL users
      const deviceCheck = await User.findOne({ deviceFingerprint, trialUsed: true });
      if (deviceCheck) {
        return reply.status(403).send({ 
          success: false, 
          message: 'This device has already used a free trial', 
          code: 'DEVICE_TRIAL_USED' 
        });
      }

      // 3. Set trial fields
      const now = new Date();
      const trialEndsAt = new Date();
      trialEndsAt.setDate(now.getDate() + 7);

      user.subscriptionStatus = 'trial';
      user.subscriptionTier = 'pro';
      user.trialStartDate = now;
      user.trialEndsAt = trialEndsAt;
      user.trialUsed = true;
      user.trialStarted = true;
      user.deviceFingerprint = deviceFingerprint;
      await user.save();

      return sendSuccess(reply, {
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt
      }, 'Free trial started for 7 days');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return sendError(reply, 400, 'Invalid device fingerprint');
      }
      logger.error({ err: error }, 'Error in SubscriptionController.startTrial');
      return sendError(reply, 500, 'Failed to start trial');
    }
  }

  static async checkScanLimit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: userId } = request.user as { id: string };
      const user = await User.findById(userId);

      if (!user) {
        return sendError(reply, 401, 'User not found');
      }

      const isTrialActive = user.subscriptionStatus === 'trial' && user.trialEndsAt && user.trialEndsAt > new Date();
      const isPro = user.subscriptionTier === 'pro';
      const hasFullAccess = isPro || isTrialActive;

      if (hasFullAccess) {
        return sendSuccess(reply, { foodScansToday: user.foodScansToday }, 'Scan allowed (Pro/Trial)');
      }

      // Check daily limit for free users
      if (user.foodScansToday >= 1) {
        return reply.status(403).send({ 
          success: false, 
          message: 'You have used your free scan for today. Upgrade to Pro for unlimited scans.',
          code: 'SCAN_LIMIT_REACHED' 
        });
      }

      return sendSuccess(reply, { foodScansToday: user.foodScansToday }, 'Scan allowed');
    } catch (error) {
      logger.error({ err: error }, 'Error in SubscriptionController.checkScanLimit');
      return sendError(reply, 500, 'Internal server error');
    }
  }

  static async getStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: userId } = request.user as { id: string };
      const user = await User.findById(userId);

      if (!user) {
        return sendError(reply, 401, 'User not found');
      }

      const isTrialActive = user.subscriptionStatus === 'trial' && user.trialEndsAt && user.trialEndsAt > new Date();
      const isPro = user.subscriptionTier === 'pro';

      return sendSuccess(reply, {
        status: user.subscriptionStatus,
        trialUsed: user.trialUsed,
        trialEndsAt: user.trialEndsAt,
        scansUsedToday: user.foodScansToday,
        isPro: isPro || isTrialActive
      }, 'Subscription status fetched');
    } catch (error) {
      logger.error({ err: error }, 'Error in SubscriptionController.getStatus');
      return sendError(reply, 500, 'Failed to fetch subscription status');
    }
  }
}
