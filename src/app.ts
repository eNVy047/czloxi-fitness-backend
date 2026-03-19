import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
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

  // Custom Plugins
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(activityPlugin);

  // Healthcheck
  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
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
  
  // Isolated Admin Routes
  const adminRoutes = (await import('./admin/admin.routes')).default;
  await app.register(adminRoutes, { prefix: `${env.API_PREFIX}` });

  // Midnight Cron: pre-create next day's DailyLog for all users with fresh goal snapshots
  // and auto-apply daily routines/sleep schedules
  cron.schedule('0 0 * * *', async () => {
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) {
      logger.warn('Skipping midnight reset: MongoDB not connected.');
      return;
    }
    await DashboardService.midnightReset();
    await ActivityService.applyDailyRoutines();
    
    try {
      const { NotificationService } = await import('./modules/notifications/notification.service');
      const { UserProfile } = await import('./models/UserProfile');
      
      // Schedule daily workout check-ins for all active users
      const profiles = await UserProfile.find({});
      for (const profile of profiles) {
        await NotificationService.scheduleWorkoutCheckIn(profile.userId.toString());
      }
      logger.info(`Scheduled workout check-ins for ${profiles.length} users.`);
    } catch (err) {
      logger.error({ err }, 'Error scheduling midnight check-ins');
    }
  });

  // Cleanup cron: delete expired 'test' FoodScans at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 1) return;
      const result = await FoodScan.deleteMany({
        type: 'test',
        expiresAt: { $lte: new Date() }
      });
      if (result.deletedCount > 0) {
        logger.info(`Deleted ${result.deletedCount} expired test food scans.`);
      }
    } catch (error) {
      logger.error({ err: error }, 'Error deleting expired test food scans');
    }
  });

  // Trial Expiry Cron: check for users whose trial has ended
  cron.schedule('0 0 * * *', async () => {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 1) return;
      const now = new Date();
      const expiredUsers = await User.find({ 
        subscriptionStatus: 'trial', 
        trialEndsAt: { $lt: now } 
      });
      
      if (expiredUsers.length > 0) {
        const { NotificationService } = await import('./modules/notifications/notification.service');
        for (const user of expiredUsers) {
          user.subscriptionStatus = 'expired';
          await user.save();
          
          await NotificationService.sendPushNotification(
            (user._id as any).toString(), 
            "Trial Expired ⏳", 
            "Your Caloxi free trial has ended. Subscribe now to keep your access to Premium features!", 
            { type: 'promo' }
          );
        }
        logger.info(`Expired ${expiredUsers.length} trials.`);
      }
    } catch (error) {
      logger.error({ err: error }, 'Error expiring trials');
    }
  });

  // 8:00 PM — daily burnt calories summary
  cron.schedule("0 20 * * *", async () => {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 1) return;
      
      const { ActivityLog } = await import('./models/ActivityLog');
      const { User } = await import('./models/User');
      const { NotificationService } = await import('./modules/notifications/notification.service');
      
      const today = new Date().toISOString().split('T')[0];
      const users = await User.find({ expoPushToken: { $exists: true, $ne: '' } });
      
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
      logger.info(`Sent daily burn summary to ${users.length} users.`);
    } catch (error) {
      logger.error({ err: error }, 'Error sending daily burn summary');
    }
  });

  // Subscription Expiry Cron: check for users whose subscription has ended
  cron.schedule('0 0 * * *', async () => {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 1) return;
      const now = new Date();
      const expiredUsers = await User.find({ 
        subscriptionStatus: 'active', 
        subscriptionEndDate: { $lt: now } 
      });
      
      if (expiredUsers.length > 0) {
        const { NotificationService } = await import('./modules/notifications/notification.service');
        for (const user of expiredUsers) {
          user.subscriptionStatus = 'expired';
          await user.save();
          
          await NotificationService.sendPushNotification(
            (user._id as any).toString(), 
            "Subscription Expired 📉", 
            "Your Caloxi Premium subscription has ended. Renew now to unlock all features!", 
            { type: 'promo' }
          );
        }
        logger.info(`Expired ${expiredUsers.length} subscriptions.`);
      }
    } catch (error) {
      logger.error({ err: error }, 'Error expiring subscriptions');
    }
  });

  // Scheduled Notification Cron: check and send pending scheduled notifications every minute
  cron.schedule('* * * * *', async () => {
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState !== 1) {
        logger.warn('Skipping scheduled notifications cron: MongoDB not connected.');
        return;
      }
      const { NotificationService } = await import('./modules/notifications/notification.service');
      await NotificationService.sendScheduledNotifications();
    } catch (error) {
      logger.error({ err: error }, 'Error processing scheduled notifications');
    }
  });

  return app;
};
