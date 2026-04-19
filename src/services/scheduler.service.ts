import cron from 'node-cron';
import { NotificationService } from '../modules/notifications/notification.service';
import { logger } from '../utils/logger';

export class SchedulerService {
  /**
   * Initializes all cron jobs for the application
   */
  static init() {
    logger.info('⏲️ Initializing Scheduler Service...');

    // 1. Daily Subscription Reminders at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
      logger.info('🔔 Running daily 9:00 AM subscription reminders...');
      await NotificationService.sendSubscriptionRemindersToAllExpired();
    }, {
      timezone: "Asia/Kolkata"
    });

    // 2. Clear stale notifications or other maintenance tasks can go here
    
    logger.info('✅ Scheduler Service initialized and jobs scheduled');
  }

  /**
   * Manual trigger for testing purposes
   */
  static async triggerSubscriptionRemindersManual() {
     logger.info('🧪 Manually triggering subscription reminders for verification...');
     await NotificationService.sendSubscriptionRemindersToAllExpired();
  }
}
