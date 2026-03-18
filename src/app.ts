import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errors';

import authPlugin from './plugins/auth.plugin';
import rateLimitPlugin from './plugins/rateLimit.plugin';

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

  // Midnight Cron: pre-create next day's DailyLog for all users with fresh goal snapshots
  // and auto-apply daily routines/sleep schedules
  cron.schedule('0 0 * * *', async () => {
    await DashboardService.midnightReset();
    await ActivityService.applyDailyRoutines();
  });

  // Cleanup cron: delete expired 'test' FoodScans at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
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
      const now = new Date();
      const result = await User.updateMany(
        { 
          subscriptionStatus: 'trial', 
          trialEndsAt: { $lt: now } 
        },
        { 
          subscriptionStatus: 'expired' 
        }
      );
      if (result.modifiedCount > 0) {
        logger.info(`Expired ${result.modifiedCount} trials.`);
      }
    } catch (error) {
      logger.error({ err: error }, 'Error expiring trials');
    }
  });

  // Subscription Expiry Cron: check for users whose subscription has ended
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const result = await User.updateMany(
        { 
          subscriptionStatus: 'active', 
          subscriptionEndDate: { $lt: now } 
        },
        { 
          subscriptionStatus: 'expired' 
        }
      );
      if (result.modifiedCount > 0) {
        logger.info(`Expired ${result.modifiedCount} subscriptions.`);
      }
    } catch (error) {
      logger.error({ err: error }, 'Error expiring subscriptions');
    }
  });

  return app;
};
