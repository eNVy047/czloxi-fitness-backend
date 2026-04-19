import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { User } from '../../models/User';
import { UserProfile } from '../../models/UserProfile';
import { SleepSchedule } from '../../models/SleepSchedule';
import { Notification } from '../../models/Notification';
import { logger } from '../../utils/logger';

const expo = new Expo();

export class NotificationService {
  /**
   * Sends a push notification to a specific user
   */
  static async sendPushNotification(userId: string, title: string, body: string, data?: any) {
    try {
      const user = await User.findById(userId);
      const pushToken = user?.expoPushToken;

      if (!pushToken) {
        logger.info({ userId }, 'No push token found for user, skipping notification');
        return;
      }

      const message: ExpoPushMessage = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: { ...data },
      };

      const chunks = expo.chunkPushNotifications([message]);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          logger.error({ err: error }, 'Error sending notification chunk');
        }
      }

      await Notification.create({
        userId,
        title,
        message: body,
        status: 'sent',
        sentAt: new Date()
      });
    } catch (error) {
      logger.error({ err: error }, 'Error in sendPushNotification');
    }
  }

  /**
   * Sends notifications in bulk to a list of users
   */
  static async sendBulk(notificationId: string) {
    const notification = await Notification.findById(notificationId);
    if (!notification) return;

    try {
      notification.status = 'pending';
      await notification.save();

      let targetUsers: any[] = [];
      if (notification.targetType === 'all') {
        targetUsers = await User.find({ expoPushToken: { $exists: true, $ne: '' } });
      } else if (notification.targetType === 'selected') {
        targetUsers = await User.find({ _id: { $in: notification.targetUserIds }, expoPushToken: { $exists: true, $ne: '' } });
      } else if (notification.targetType === 'filter') {
        const query: any = { expoPushToken: { $exists: true, $ne: '' } };
        if (notification.targetFilter?.subscriptionStatus?.length) {
          query.subscriptionStatus = { $in: notification.targetFilter.subscriptionStatus };
        }
        if (notification.targetFilter?.fitnessGoal?.length) {
          query.fitnessGoal = { $in: notification.targetFilter.fitnessGoal };
        }
        if (notification.targetFilter?.inactiveDays) {
          const cutOff = new Date();
          cutOff.setDate(cutOff.getDate() - notification.targetFilter.inactiveDays);
          query.lastActiveAt = { $lt: cutOff };
        }
        targetUsers = await User.find(query);
      }

      const tickets: any[] = [];
      const messages: ExpoPushMessage[] = targetUsers.map(u => ({
        to: u.expoPushToken!,
        sound: 'default',
        title: notification.title,
        body: notification.message,
      }));

      const chunks = expo.chunkPushNotifications(messages);
      let totalSent = 0;
      let delivered = 0;
      let failed = 0;

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          totalSent += chunk.length;
          delivered += ticketChunk.filter(t => t.status === 'ok').length;
          failed += ticketChunk.filter(t => t.status === 'error').length;
        } catch (error) {
          logger.error({ err: error }, 'Error sending bulk chunk');
          failed += chunk.length;
        }
      }

      notification.status = 'sent';
      notification.sentAt = new Date();
      notification.totalSent = totalSent;
      notification.delivered = delivered;
      notification.failed = failed;
      await notification.save();

      const individualNotifs = targetUsers.map(u => ({
        userId: u._id,
        title: notification.title,
        message: notification.message,
        status: 'sent',
        sentAt: new Date(),
        isRead: false
      }));
      if (individualNotifs.length > 0) {
        await Notification.insertMany(individualNotifs);
      }
    } catch (error) {
      logger.error({ err: error, notificationId }, 'Error in sendBulk');
      notification.status = 'failed';
      await notification.save();
    }
  }

  static async sendScheduledNotifications() {
    const now = new Date();
    const pending = await Notification.find({
      status: 'scheduled',
      scheduledAt: { $lte: now }
    });

    for (const notification of pending) {
      if (notification.targetType) {
        await this.sendBulk((notification._id as any).toString());
      } else if (notification.userId) {
        await this.sendPushNotification(
          notification.userId.toString(),
          notification.title,
          notification.message,
        );
        notification.status = 'sent';
        notification.sentAt = new Date();
        await notification.save();
      }
    }
  }

  // ... (keeping existing resolvedPreferredTime and workout logic but adapted to new fields if needed)
  static async scheduleWorkoutCheckIn(userId: string) {
    const user = await User.findById(userId);
    const profile = await UserProfile.findOne({ userId });
    if (!user || !profile) return;
    const now = new Date();
    const target = this.resolvePreferredTime(now, profile.workoutTimePreference || 'flexible');
    const delayMs = target.getTime() - now.getTime();
    if (delayMs <= 0) {
      await this.sendWorkoutCheckIn(userId);
      return;
    }

    // Clear any existing scheduled check-ins to prevent duplicates
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    await Notification.deleteMany({
      userId,
      type: 'reminder',
      status: 'scheduled',
      scheduledAt: { $gte: todayStart }
    });

    await Notification.create({
      userId,
      title: "Workout Check-in 🏋️‍♂️",
      message: "Hey! Did you get your workout in today?",
      status: 'scheduled',
      scheduledAt: target
    });
  }

  static async sendWorkoutCheckIn(userId: string) {
    await this.sendPushNotification(userId, "Workout Check-in 🏋️‍♂️", "Hey! Did you get your workout in today?", { type: 'reminder' });
  }

  static async rescheduleCheckIn(userId: string) {
    const now = new Date();
    const sleep = await SleepSchedule.findOne({ userId, isDaily: true });
    let bedtimeToday: Date | null = null;
    if (sleep?.defaultBedtime) {
      const [h, m] = sleep.defaultBedtime.split(':').map(Number);
      bedtimeToday = new Date(now);
      bedtimeToday.setHours(h, m, 0, 0);
    }
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    let target = twoHoursLater;
    if (bedtimeToday && bedtimeToday.getTime() < twoHoursLater.getTime()) {
      target = bedtimeToday;
    }
    const isFinal = bedtimeToday !== null && target.getTime() === bedtimeToday.getTime();
    const delayMs = target.getTime() - now.getTime();
    if (delayMs <= 0) {
      isFinal ? await this.sendFinalWorkoutCheckIn(userId) : await this.sendWorkoutCheckIn(userId);
      return;
    }

    await Notification.create({
      userId,
      title: isFinal ? "Before you sleep — did you workout today? 🌙" : "Workout Check-in 🏋️‍♂️",
      message: isFinal ? "Log your workout before ending your day." : "Hey! Did you get your workout in today?",
      status: 'scheduled',
      scheduledAt: target
    });
  }

  static async sendFinalWorkoutCheckIn(userId: string) {
    await this.sendPushNotification(userId, "Before you sleep — did you workout today? 🌙", "Log your workout before ending your day.", { type: 'reminder' });
  }

  private static resolvePreferredTime(base: Date, pref: any): Date {
    const target = new Date(base);
    switch (pref) {
      case 'morning': target.setHours(6, 0, 0, 0); break;
      case 'afternoon': target.setHours(12, 0, 0, 0); break;
      case 'evening': target.setHours(17, 0, 0, 0); break;
      case 'night': target.setHours(20, 0, 0, 0); break;
      default: target.setHours(18, 0, 0, 0); break;
    }
    return target;
  }

  /**
   * Sends a persuasive subscription reminder to a specific user
   */
  static async sendSubscriptionReminder(userId: string) {
    const title = "Upgrade to Caloxi Pro! 🚀";
    const body = "Your 7-day trial has ended. Subscribe now to unlock unlimited AI Chat coaching and 15 scans per day!";
    await this.sendPushNotification(userId, title, body, { type: 'subscription_reminder' });
  }

  /**
   * Batch sends subscription reminders to all users who have finished their trial
   */
  static async sendSubscriptionRemindersToAllExpired() {
    logger.info('🚀 Starting batch subscription reminders...');
    try {
      const now = new Date();
      // Target users who are on 'free' tier and trial is past
      const expiredUsers = await User.find({
        subscriptionTier: 'free',
        trialEndsAt: { $lt: now },
        expoPushToken: { $exists: true, $ne: '' }
      });

      logger.info({ count: expiredUsers.length }, '🎯 Found expired users for reminders');

      for (const user of expiredUsers) {
        await this.sendSubscriptionReminder(user._id.toString());
      }

      logger.info('✅ Batch subscription reminders completed');
    } catch (error) {
      logger.error({ err: error }, '❌ Error in sendSubscriptionRemindersToAllExpired');
    }
  }
}
