import { Expo } from 'expo-server-sdk';
import { UserProfile } from '../../models/UserProfile';
import { SleepSchedule } from '../../models/SleepSchedule';
import { logger } from '../../utils/logger';

const expo = new Expo();

export class NotificationService {
  /**
   * Sends a push notification to a specific user
   */
  static async sendPushNotification(userId: string, title: string, body: string, data?: any, category?: string) {
    try {
      const profile = await UserProfile.findOne({ userId });
      if (!profile || !profile.pushToken) {
        logger.info({ userId }, 'No push token found for user, skipping notification');
        return;
      }

      const pushToken = profile.pushToken;
      if (!Expo.isExpoPushToken(pushToken)) {
        logger.error({ pushToken }, 'Invalid Expo push token');
        return;
      }

      const message: any = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: { ...data, categoryIdentifier: category },
      };

      const chunks = expo.chunkPushNotifications([message]);
      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          logger.info({ ticketChunk }, 'Notification sent successfully');
        } catch (error) {
          logger.error({ err: error }, 'Error sending notification chunk');
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Error in sendPushNotification');
    }
  }

  /**
   * Schedules a workout check-in notification for a user
   * Computes the preferred time window based on workoutTimePreference
   * and schedules a notification using an in-memory timer.
   */
  static async scheduleWorkoutCheckIn(userId: string) {
    const profile = await UserProfile.findOne({ userId });
    if (!profile) return;

    const now = new Date();
    const target = this.resolvePreferredTime(now, profile.workoutTimePreference || 'flexible');

    const delayMs = target.getTime() - now.getTime();
    logger.info({ userId, timePref: profile.workoutTimePreference, targetTime: target.toISOString(), delayMs }, 'Scheduling workout check-in');

    if (delayMs <= 0) {
      // Fallback: send immediately if the window for today has already passed
      await this.sendWorkoutCheckIn(userId);
      return;
    }

    setTimeout(() => {
      this.sendWorkoutCheckIn(userId).catch(err => {
        logger.error({ err, userId }, 'Failed to send scheduled workout check-in');
      });
    }, delayMs);
  }

  static async sendWorkoutCheckIn(userId: string) {
    await this.sendPushNotification(
      userId,
      "Workout Check-in 🏋️‍♂️",
      "Hey! Did you get your workout in today?",
      { type: 'WORKOUT_CHECKIN' },
      'workout-checkin' // Matches frontend category
    );
  }

  /**
   * Reschedules a workout check-in for \"remind me later\":
   *  - 2 hours from now OR
   *  - At the user's default bedtime, whichever is sooner.
   */
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

    logger.info(
      { userId, now: now.toISOString(), targetTime: target.toISOString(), delayMs, isFinal },
      'Rescheduling workout check-in'
    );

    if (delayMs <= 0) {
      if (isFinal) {
        await this.sendFinalWorkoutCheckIn(userId);
      } else {
        await this.sendWorkoutCheckIn(userId);
      }
      return;
    }

    setTimeout(() => {
      const fn = isFinal ? this.sendFinalWorkoutCheckIn.bind(this) : this.sendWorkoutCheckIn.bind(this);
      fn(userId).catch(err => {
        logger.error({ err, userId, isFinal }, 'Failed to send rescheduled workout check-in');
      });
    }, delayMs);
  }

  /**
   * Sends the final bedtime check-in notification.
   */
  static async sendFinalWorkoutCheckIn(userId: string) {
    await this.sendPushNotification(
      userId,
      "Before you sleep — did you workout today? 🌙",
      "Log your workout before ending your day.",
      { type: 'WORKOUT_CHECKIN_FINAL' },
      'workout-checkin-final'
    );
  }

  /**
   * Helper to convert a preference into a concrete time today.
   */
  private static resolvePreferredTime(base: Date, pref: 'morning' | 'afternoon' | 'evening' | 'night' | 'flexible'): Date {
    const target = new Date(base);

    switch (pref) {
      case 'morning':
        target.setHours(6, 0, 0, 0);
        break;
      case 'afternoon':
        target.setHours(12, 0, 0, 0);
        break;
      case 'evening':
        target.setHours(17, 0, 0, 0);
        break;
      case 'night':
        target.setHours(20, 0, 0, 0);
        break;
      case 'flexible':
      default:
        target.setHours(18, 0, 0, 0);
        break;
    }

    return target;
  }
}
