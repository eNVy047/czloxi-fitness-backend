import { DailyLog, IDailyLog } from '../../models/DailyLog';
import { UserProfile } from '../../models/UserProfile';
import { ProfileService } from '../profile/profile.service';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { NotificationService } from '../notifications/notification.service';

function todayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export class DashboardService {
  /**
   * Build a fresh DailyLog document for a specific date using the user's current profile goals.
   */
  private static async buildNewLog(userId: string, date: string): Promise<IDailyLog> {
    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      throw new NotFoundError('User profile not found. Please complete profile setup.');
    }

    const goals = profile.goals || ProfileService.calculateGoals({
      age: profile.age,
      gender: profile.gender,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      activityLevel: profile.activityLevel,
      fitnessGoal: profile.fitnessGoal,
      targetWeight: profile.targetWeight,
    });

    const log = new DailyLog({
      userId,
      date,
      caloriesConsumed: 0,
      calorieGoal: goals.calorieGoal,
      fatConsumed: 0,
      fatGoal: goals.fatGoal,
      proteinConsumed: 0,
      proteinGoal: goals.proteinGoal,
      carbsConsumed: 0,
      carbsGoal: goals.carbsGoal,
      waterGlasses: 0,
      waterGoal: goals.waterGlasses,
      stepGoal: goals.stepGoal,
      caloriesBurnt: 0,
      goalsMeta: {
        calorieGoal: goals.calorieGoal,
        proteinGoal: goals.proteinGoal,
        carbsGoal: goals.carbsGoal,
        fatGoal: goals.fatGoal,
        waterGlasses: goals.waterGlasses,
        stepGoal: goals.stepGoal,
      },
    });

    await log.save();
    return log;
  }

  /**
   * Get or create today's daily log.
   */
  static async getOrCreateTodayLog(userId: string): Promise<any> {
    const today = todayString();
    let log: any = await DailyLog.findOne({ userId, date: today });
    if (!log) {
      log = await this.buildNewLog(userId, today);
    } else if (log.calorieGoal === undefined) {
      // Patch old documents that lack the required goal fields
      const profile = await UserProfile.findOne({ userId });
      if (profile) {
        const goals = profile.goals || ProfileService.calculateGoals({
          age: profile.age,
          gender: profile.gender as any,
          weightKg: profile.weightKg,
          heightCm: profile.heightCm,
          activityLevel: profile.activityLevel as any,
          fitnessGoal: profile.fitnessGoal as any,
          targetWeight: profile.targetWeight
        });
        log.calorieGoal = goals.calorieGoal;
        log.proteinGoal = goals.proteinGoal;
        log.carbsGoal = goals.carbsGoal;
        log.fatGoal = goals.fatGoal;
        log.waterGoal = goals.waterGlasses;
        log.stepGoal = goals.stepGoal;
      }
    }
    return log;
  }

  /**
   * Get a daily log for any specific date.
   * - Today: create if missing.
   * - Past: return zeroed log object (not saved) if no entry exists.
   * - Future: throw error.
   */
  static async getDayLog(userId: string, date: string): Promise<any> {
    const today = todayString();
    
    // Allow up to 1 day in the future to account for timezones
    const serverTomorrow = format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

    if (date > serverTomorrow) {
      throw new Error('Cannot fetch logs for future dates.');
    }

    let log: any = await DailyLog.findOne({ userId, date });

    if (!log && (date === today || date === serverTomorrow)) {
      log = await this.buildNewLog(userId, date);
    }

    if (!log) {
      // Past date with no entry — return zeroed object with current goals as reference
      const profile = await UserProfile.findOne({ userId });
      const goals = profile
        ? (profile.goals || ProfileService.calculateGoals({
            age: profile.age,
            gender: profile.gender as any,
            weightKg: profile.weightKg,
            heightCm: profile.heightCm,
            activityLevel: profile.activityLevel as any,
            fitnessGoal: profile.fitnessGoal as any,
            targetWeight: profile.targetWeight,
          }))
        : { calorieGoal: 2000, proteinGoal: 150, carbsGoal: 200, fatGoal: 67, waterGlasses: 8, stepGoal: 10000, caloriesBurntGoal: 300, sleepGoal: 8 };

      return {
        date,
        caloriesConsumed: 0,
        calorieGoal: goals.calorieGoal,
        fatConsumed: 0,
        fatGoal: goals.fatGoal,
        proteinConsumed: 0,
        proteinGoal: goals.proteinGoal,
        carbsConsumed: 0,
        carbsGoal: goals.carbsGoal,
        waterGlasses: 0,
        waterGoal: goals.waterGlasses,
        stepGoal: goals.stepGoal,
        caloriesBurnt: 0,
        goalMet: false,
        goalsMeta: {
          calorieGoal: goals.calorieGoal,
          proteinGoal: goals.proteinGoal,
          carbsGoal: goals.carbsGoal,
          fatGoal: goals.fatGoal,
          waterGlasses: goals.waterGlasses,
          stepGoal: goals.stepGoal,
        },
      } as Partial<IDailyLog>;
    } else if (log.calorieGoal === undefined) {
      // Patch old documents that lack the required goal fields
      const profile = await UserProfile.findOne({ userId });
      if (profile) {
        const goals = profile.goals || ProfileService.calculateGoals({
          age: profile.age,
          gender: profile.gender as any,
          weightKg: profile.weightKg,
          heightCm: profile.heightCm,
          activityLevel: profile.activityLevel as any,
          fitnessGoal: profile.fitnessGoal as any,
          targetWeight: profile.targetWeight
        });
        log.calorieGoal = goals.calorieGoal;
        log.proteinGoal = goals.proteinGoal;
        log.carbsGoal = goals.carbsGoal;
        log.fatGoal = goals.fatGoal;
        log.waterGoal = goals.waterGlasses;
        log.stepGoal = goals.stepGoal;
      }
    }

    return log;
  }

  /**
   * Get all logs for the current week (Sun–Sat) for calendar dot rendering.
   */
  static async getWeekLogs(userId: string): Promise<any[]> {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });     // Saturday

    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const dateStrings = days.map(d => format(d, 'yyyy-MM-dd'));

    const logs = await DailyLog.find({
      userId,
      date: { $in: dateStrings },
    }).select('date goalMet caloriesConsumed calorieGoal');

    // Build full week array with default for missing days
    return dateStrings.map(dateStr => {
      const log = logs.find(l => l.date === dateStr);
      return {
        date: dateStr,
        goalMet: log?.goalMet ?? null,
        caloriesConsumed: log?.caloriesConsumed ?? 0,
        calorieGoal: log?.calorieGoal ?? 2000,
        hasData: !!log,
      };
    });
  }

  /**
   * Midnight reset: pre-creates the next day's DailyLog for all users who have a profile.
   * Called by a cron job at midnight.
   */
  static async midnightReset(): Promise<void> {
    try {
      const tomorrow = format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const profiles = await UserProfile.find({}).select('userId');

      let created = 0;
      for (const p of profiles) {
        const existing = await DailyLog.findOne({ userId: p.userId, date: tomorrow });
        if (!existing) {
          try {
            await this.buildNewLog(p.userId.toString(), tomorrow);
            created++;
          } catch (_err) {
            // Skip users with incomplete profiles
          }
        }
      }
      logger.info(`Midnight reset: pre-created ${created} daily logs for ${tomorrow}`);
    } catch (error) {
      logger.error({ err: error }, 'Error in DashboardService.midnightReset');
    }
  }

  /**
   * Increments the water glasses count for today.
   */
  static async addWaterGlass(userId: string, date?: string): Promise<IDailyLog> {
    const log = await this.getDayLog(userId, date || todayString());
    const before = log.waterGlasses;
    log.waterGlasses += 1;
    await log.save();
    
    if (log.waterGoal > 0 && before < log.waterGoal && log.waterGlasses >= log.waterGoal) {
      await NotificationService.sendPushNotification(
        userId, 
        "Hydration Goal Met! 💧", 
        `Great job drinking ${log.waterGoal} glasses of water today!`, 
        { type: 'achievement' }
      );
    }
    
    return log;
  }
}
