import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errors';

import authPlugin from './plugins/auth.plugin';
import rateLimitPlugin from './plugins/rateLimit.plugin';
import activityPlugin from './plugins/activity.plugin';

import authRoutes from './modules/auth/auth.routes';
import profileRoutes from './modules/profile/profile.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import foodScanRoutes from './modules/foodScan/foodScan.routes';
import activityRoutes from './modules/activity/activity.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import progressRoutes from './modules/progress/progress.routes';
import paymentRoutes from './modules/payment/payment.routes';
import userRoutes from './modules/profile/user.routes';
import chatRoutes from './modules/chat/chat.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import cron from 'node-cron';
import { User } from './models/User';
import { FoodScan } from './models/FoodScan';
import { DashboardService } from './modules/dashboard/dashboard.service';
import { ActivityService } from './modules/activity/activity.service';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: false, // Using Pino indirectly, but Fastify's native logger is false to avoid double logging
    trustProxy: true,
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Security & Core Plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });
  await app.register(compress);

  // Custom Plugins
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(activityPlugin);

  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  // Diagnostic Routes (Temporary)
  app.get(`${env.API_PREFIX}/debug-routes`, async () => {
    return { routes: app.printRoutes() };
  });

  // Mount API Routes
  await app.register(authRoutes, { prefix: `${env.API_PREFIX}/auth` });
  await app.register(profileRoutes, { prefix: `${env.API_PREFIX}/profile` });
  await app.register(dashboardRoutes, { prefix: `${env.API_PREFIX}/dashboard` });
  await app.register(foodScanRoutes, { prefix: `${env.API_PREFIX}/food` });
  await app.register(activityRoutes, { prefix: `${env.API_PREFIX}/activity` });
  await app.register(notificationRoutes, { prefix: `${env.API_PREFIX}/notifications` });
  await app.register(progressRoutes, { prefix: `${env.API_PREFIX}/progress` });
  await app.register(paymentRoutes, { prefix: `${env.API_PREFIX}/payment` });
  await app.register(userRoutes, { prefix: `${env.API_PREFIX}/user` });
  await app.register(chatRoutes, { prefix: `${env.API_PREFIX}/chat` });
  await app.register(subscriptionRoutes, { prefix: `${env.API_PREFIX}/subscription` });
  
  // Isolated Admin Routes
  const adminRoutes = (await import('./admin/admin.routes')).default;
  await app.register(adminRoutes, { prefix: `${env.API_PREFIX}` });

  // --- 🕛 MIDNIGHT SYSTEM MAINTENANCE ---
  cron.schedule('0 0 * * *', async () => {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 1) {
        logger.warn('Skipping midnight maintenance: MongoDB not connected.');
        return;
      }

      logger.info('🚀 Starting midnight system maintenance...');

      // 1. Dashboard & Activity Resets
      await DashboardService.midnightReset();
      await ActivityService.applyDailyRoutines();

      // 2. Load Services for background tasks
      const { NotificationService } = await import('./modules/notifications/notification.service');
      const { UserProfile } = await import('./models/UserProfile');
      const now = new Date();

      // 3. Cleanup: Expired test scans
      const foodCleanup = await FoodScan.deleteMany({
        type: 'test',
        expiresAt: { $lte: now }
      });
      if (foodCleanup.deletedCount > 0) logger.info(`Cleanup: Deleted ${foodCleanup.deletedCount} test scans.`);

      // 4. Subscription & Trial Expiry + Scan Reset
      const scanReset = await User.updateMany({}, { $set: { foodScansToday: 0 } });
      logger.info(`Maintenance: Reset daily food scans for ${scanReset.matchedCount} users.`);

      // Trial users
      const expiredTrialUsers = await User.find({ 
        subscriptionStatus: 'trial', 
        trialEndsAt: { $lt: now },
        fcmToken: { $exists: true, $nin: [null, ''] }
      });
      
      for (const user of expiredTrialUsers) {
        user.subscriptionStatus = 'expired';
        await user.save();
        await NotificationService.sendPushNotification(
          (user._id as any).toString(), 
          "Trial Expired ⏳", 
          "Your Caloxi free trial has ended. Subscribe now to keep your access!", 
          { type: 'promo' }
        );
      }

      // Pro users
      const expiredProUsers = await User.find({ 
        subscriptionStatus: 'active', 
        subscriptionEndDate: { $lt: now },
        fcmToken: { $exists: true, $nin: [null, ''] }
      });
      
      for (const user of expiredProUsers) {
        user.subscriptionStatus = 'expired';
        await user.save();
        await NotificationService.sendPushNotification(
          (user._id as any).toString(), 
          "Subscription Expired 📉", 
          "Your Caloxi Premium has ended. Renew now to stay on track!", 
          { type: 'promo' }
        );
      }

      // 5. Schedule daily workout check-ins
      const profiles = await UserProfile.find({});
      for (const profile of profiles) {
        await NotificationService.scheduleWorkoutCheckIn(profile.userId.toString());
      }

      logger.info('✅ Midnight maintenance completed.');
    } catch (error) {
      logger.error({ err: error }, 'Error during midnight maintenance');
    }
  });

  // 8:00 PM — daily burnt calories summary
  cron.schedule("0 20 * * *", async () => {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 1) return;
      
      const { ActivityLog } = await import('./models/ActivityLog');
      const { NotificationService } = await import('./modules/notifications/notification.service');
      
      const today = new Date().toISOString().split('T')[0];
      const users = await User.find({ fcmToken: { $exists: true, $nin: [null, ''] } });
      
      for (const user of users) {
        const log = await ActivityLog.findOne({ userId: user._id, date: today });
        const total = log?.totalCaloriesBurnt || 0;
        const goal = (user as any).goals?.caloriesBurntGoal || 500;
        
        await NotificationService.sendPushNotification(
          (user._id as any).toString(),
          "🔥 Daily Burn Summary",
          `You burned ${total} kcal today out of your ${goal} kcal goal!`,
          { type: 'activity' }
        );
      }
    } catch (error) {
      logger.error({ err: error }, 'Error sending daily burn summary');
    }
  });

  // Scheduled Notification Cron: every minute
  cron.schedule('* * * * *', async () => {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 1) return;
      const { NotificationService } = await import('./modules/notifications/notification.service');
      await NotificationService.sendScheduledNotifications();
    } catch (error) {
      logger.error({ err: error }, 'Error processing scheduled notifications');
    }
  });

  return app;
};
