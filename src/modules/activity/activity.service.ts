import { ActivityLog, IActivityLog } from '../../models/ActivityLog';
import { DailyLog } from '../../models/DailyLog';
import { ExerciseLibrary } from '../../models/ExerciseLibrary';
import { ExerciseRoutine } from '../../models/ExerciseRoutine';
import { SleepSchedule } from '../../models/SleepSchedule';
import { UserProfile } from '../../models/UserProfile';
import { NotificationService } from '../notifications/notification.service';
import { logger } from '../../utils/logger';

export class ActivityService {
  static async getOrCreateTodayActivity(userId: string, targetDate?: string): Promise<IActivityLog> {
    const today = new Date().toISOString().split('T')[0];
    const fetchDate = targetDate || today;
    let log = await ActivityLog.findOne({ userId, date: fetchDate });

    if (!log && fetchDate === today) {
      return this.createTodayLog(userId);
    }

    if (!log) {
      log = await ActivityLog.create({
        userId,
        date: fetchDate,
        steps: 0,
        stepCalories: 0,
        totalCaloriesBurnt: 0,
        activeMinutes: 0,
        distance: 0,
        exercises: [],
      });
    }

    return log;
  }

  static async updateSteps(userId: string, steps: number, date?: string): Promise<IActivityLog> {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = date || today;
    
    // Calculate new values
    const stepCalories = Math.round(steps * 0.04);
    const distance = parseFloat((steps * 0.0008).toFixed(2)); // km

    const log = await ActivityLog.findOneAndUpdate(
      { userId, date: targetDate },
      { $set: { steps, stepCalories, distance } },
      { new: true, upsert: true }
    );

    const syncedLog = await this.syncToDailyLog(userId, targetDate);
    return syncedLog || log;
  }

  static async logExercise(userId: string, exerciseData: {
    exerciseName: string;
    duration: number;
    sets?: number;
    reps?: number;
    isDaily?: boolean;
    days?: string[];
    date?: string;
  }): Promise<IActivityLog> {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = exerciseData.date || today;
    
    // Get Exercise MET
    let selectedMet = 6; // Default MET if not found in library
    const exercise = await ExerciseLibrary.findOne({ name: exerciseData.exerciseName });
    if (exercise) {
      selectedMet = exercise.met;
    }

    // Get User Weight
    const profile = await UserProfile.findOne({ userId });
    if (!profile) throw new Error('User profile not found');

    //MET formula: calories = MET * weight(kg) * (duration/60)
    const caloriesBurnt = Math.round(selectedMet * profile.weightKg * (exerciseData.duration / 60));

    const log = await ActivityLog.findOneAndUpdate(
      { userId, date: targetDate },
      {
        $push: {
          exercises: {
            name: exerciseData.exerciseName,
            met: selectedMet,
            duration: exerciseData.duration,
            sets: exerciseData.sets,
            reps: exerciseData.reps,
            caloriesBurnt,
            isRoutine: exerciseData.isDaily || false,
          }
        }
      },
      { new: true, upsert: true }
    );

    if (exerciseData.isDaily && exerciseData.days && exerciseData.days.length > 0) {
      await ExerciseRoutine.create({
        userId,
        exerciseName: exerciseData.exerciseName,
        met: selectedMet,
        duration: exerciseData.duration,
        sets: exerciseData.sets,
        reps: exerciseData.reps,
        days: exerciseData.days,
        isActive: true,
      });
    }

    const syncedLog = await this.syncToDailyLog(userId, targetDate);
    return syncedLog || log;
  }

  static async deleteExercise(userId: string, exerciseId: string): Promise<IActivityLog | null> {
    const today = new Date().toISOString().split('T')[0];
    
    const log = await ActivityLog.findOneAndUpdate(
      { userId, date: today },
      { $pull: { exercises: { _id: exerciseId } } },
      { new: true }
    );

    if (log) {
      const syncedLog = await this.syncToDailyLog(userId, today);
      return syncedLog || log;
    }
    
    return log;
  }

  static async getExerciseLibrary() {
    return ExerciseLibrary.find().sort({ name: 1 });
  }

  static async createTodayLog(userId: string): Promise<IActivityLog> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const todayDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()];

    // 1. Get active routines for today
    const routines = await ExerciseRoutine.find({ userId, isActive: true, days: todayDay });
    const profile = await UserProfile.findOne({ userId });
    
    const exercises = [];
    let routineCalories = 0;

    if (profile && routines.length > 0) {
      for (const r of routines) {
        const caloriesBurnt = Math.round(r.met * profile.weightKg * (r.duration / 60));
        exercises.push({
          name: r.exerciseName,
          met: r.met,
          duration: r.duration,
          sets: r.sets,
          reps: r.reps,
          caloriesBurnt,
          isRoutine: true,
          fromRoutine: true,
        });
        routineCalories += caloriesBurnt;
      }
    }

    // 2. Sleep schedule
    const sleep = await SleepSchedule.findOne({ userId, isDaily: true });
    let sleepData: any = {};
    if (sleep) {
      const [bH, bM] = sleep.defaultBedtime.split(':').map(Number);
      const [wH, wM] = sleep.defaultWakeTime.split(':').map(Number);
      let diff = wH - bH + (wM - bM) / 60;
      if (diff < 0) diff += 24;
      sleepData = {
        bedtime: sleep.defaultBedtime,
        wakeTime: sleep.defaultWakeTime,
        sleepHours: parseFloat(diff.toFixed(1)),
      };
    }

    // 3. Create Log
    const log = await ActivityLog.create({
      userId,
      date: dateStr,
      exercises,
      totalCaloriesBurnt: routineCalories,
      ...sleepData
    });

    // 4. Sync to DailyLog
    await DailyLog.findOneAndUpdate(
      { userId, date: dateStr },
      { 
        $set: { 
          caloriesBurnt: routineCalories,
          ...(sleepData.sleepHours ? { sleepHours: sleepData.sleepHours } : {})
        } 
      },
      { upsert: true }
    );

    return log;
  }

  static async getActivityLog(userId: string, date: string): Promise<IActivityLog | null> {
    const today = new Date().toISOString().split('T')[0];
    let log = await ActivityLog.findOne({ userId, date });
    
    if (!log && date === today) {
      return this.createTodayLog(userId);
    }
    
    return log;
  }

  // --- Sleep Methods ---

  static async logSleep(userId: string, date: string, data: {
    bedtime: string;
    wakeTime: string;
    sleepHours: number;
    sleepQuality?: '😴' | '😐' | '😊';
    isDaily?: boolean;
  }): Promise<IActivityLog> {
    const log = await ActivityLog.findOneAndUpdate(
      { userId, date },
      {
        $set: {
          bedtime: data.bedtime,
          wakeTime: data.wakeTime,
          sleepHours: data.sleepHours,
          sleepQuality: data.sleepQuality,
        }
      },
      { new: true, upsert: true }
    );

    if (data.isDaily) {
      await SleepSchedule.findOneAndUpdate(
        { userId },
        {
          $set: {
            defaultBedtime: data.bedtime,
            defaultWakeTime: data.wakeTime,
            isDaily: true,
          }
        },
        { upsert: true }
      );
    }

    // Sync sleep hours to daily log as well
    await DailyLog.findOneAndUpdate(
      { userId, date },
      { $set: { sleepHours: data.sleepHours } },
      { upsert: true }
    );

    return log;
  }

  // --- Routine Methods ---

  static async getRoutine(userId: string) {
    const sleepSchedule = await SleepSchedule.findOne({ userId });
    const exerciseRoutines = await ExerciseRoutine.find({ userId, isActive: true });
    const profile = await UserProfile.findOne({ userId });
    
    return {
      sleepSchedule,
      exerciseRoutines,
      userWeight: profile?.weightKg || 70,
    };
  }

  static async updateRoutine(userId: string, routineId: string, data: { duration?: number, days?: string[] }) {
    return ExerciseRoutine.findOneAndUpdate(
      { _id: routineId, userId },
      { $set: data },
      { new: true }
    );
  }

  static async deleteRoutine(userId: string, routineId: string) {
    return ExerciseRoutine.findOneAndUpdate(
      { _id: routineId, userId },
      { $set: { isActive: false } },
      { new: true }
    );
  }

  static async workoutCheckin(userId: string, data: { done?: boolean, remindLater?: boolean, date?: string }) {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = data.date || today;

    // Upsert the daily log to avoid race conditions if the cron job or frontend hasn't created it yet
    const updatePayload: any = {};
    if (data.done !== undefined) {
      updatePayload.exerciseLogged = data.done;
    }

    const log = await DailyLog.findOneAndUpdate(
      { userId, date: targetDate },
      { $set: updatePayload },
      { new: true, upsert: true } // Creates the skeleton if it doesn't exist at midnight
    );

    // Call notification service if they selected `remindLater`
    if (data.remindLater) {
        await NotificationService.rescheduleCheckIn(userId);
    }

    return { success: true, log };
  }

  /**
   * Called by a midnight cron job.
   * Finds all users with active routines for the current day of the week,
   * calculates calories, and inserts them into the new day's ActivityLog.
   * Also pre-fills sleep schedule if daily sleep is enabled.
   */
  static async applyDailyRoutines() {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const todayDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()];

      logger.info(`Applying daily routines for ${dateStr} (${todayDay})`);

      // 1. Get all routines for today
      const todayRoutines = await ExerciseRoutine.find({ isActive: true, days: todayDay });
      
      // Group by user
      const userRoutines: Record<string, any[]> = {};
      for (const r of todayRoutines) {
        if (!userRoutines[r.userId.toString()]) userRoutines[r.userId.toString()] = [];
        userRoutines[r.userId.toString()].push(r);
      }

      // 2. Fetch all profiles to calculate calories (need weight)
      // and apply routines user by user
      for (const [userId, routines] of Object.entries(userRoutines)) {
        const profile = await UserProfile.findOne({ userId });
        if (!profile) continue;

        const dateStr = today.toISOString().split('T')[0];

        // Fetch existing activity log once to avoid duplicating routine exercises
        let existingActivity = await ActivityLog.findOne({ userId, date: dateStr });

        const newExercises = routines
          .map(r => {
            const caloriesBurnt = Math.round(r.met * profile.weightKg * (r.duration / 60));
            return {
              name: r.exerciseName,
              met: r.met,
              duration: r.duration,
              sets: r.sets,
              reps: r.reps,
              caloriesBurnt,
              isRoutine: true,
              fromRoutine: true,
            };
          })
          .filter(ex => {
            if (!existingActivity) return true;
            return !existingActivity.exercises.some((e: any) =>
              e.fromRoutine === true &&
              e.name === ex.name &&
              e.duration === ex.duration &&
              (e.sets || null) === (ex.sets || null) &&
              (e.reps || null) === (ex.reps || null)
            );
          });

        if (newExercises.length === 0 && !existingActivity) {
          // Nothing to apply for this user
          continue;
        }

        // 3. Get sleep schedule if any
        const sleep = await SleepSchedule.findOne({ userId, isDaily: true });
        
        let sleepHours = 0;
        if (sleep) {
           // Basic hour calc: split HH:mm
           const [bH, bM] = sleep.defaultBedtime.split(':').map(Number);
           const [wH, wM] = sleep.defaultWakeTime.split(':').map(Number);
           let diff = wH - bH + (wM - bM) / 60;
           if (diff < 0) diff += 24;
           sleepHours = parseFloat(diff.toFixed(1));
        }

        // 4. Create or update ActivityLog and DailyLog
        const activityLog = await ActivityLog.findOneAndUpdate(
          { userId, date: dateStr },
          {
            ...(newExercises.length > 0 ? { $push: { exercises: { $each: newExercises } } } : {}),
            ...(sleep
              ? {
                  $set: {
                    bedtime: sleep.defaultBedtime,
                    wakeTime: sleep.defaultWakeTime,
                    sleepHours,
                  },
                }
              : {}),
          },
          { new: true, upsert: true }
        );

        if (activityLog) {
          const exerciseCalories = activityLog.exercises.reduce((sum: number, ex: any) => sum + ex.caloriesBurnt, 0);
          const totalBurnt = activityLog.stepCalories + exerciseCalories;

          activityLog.totalCaloriesBurnt = totalBurnt;
          await activityLog.save();

          await DailyLog.findOneAndUpdate(
            { userId, date: dateStr },
            { 
              $set: { 
                caloriesBurnt: totalBurnt,
                ...(sleep ? { sleepHours } : {})
              } 
            },
            { upsert: true }
          );
        }
      } // End of for user loop

      logger.info('Successfully applied daily routines and sleep schedules');
    } catch (error) {
      logger.error({ err: error }, 'Error applying daily routines');
    }
  }

  // --- Private Sync ---

  private static async syncToDailyLog(userId: string, date: string): Promise<any> {
    try {
      const activity = await ActivityLog.findOne({ userId, date });
      if (!activity) return null;

      const exerciseCalories = activity.exercises.reduce((sum: number, ex: any) => sum + ex.caloriesBurnt, 0);
      const totalBurnt = activity.stepCalories + exerciseCalories;

      // Update total burnt in ActivityLog
      activity.totalCaloriesBurnt = totalBurnt;
      await activity.save();

      // Check for step goal achievement before updating
      const dailyLog = await DailyLog.findOne({ userId, date });
      let stepGoalJustMet = false;
      if (dailyLog && dailyLog.stepGoal > 0) {
        if (dailyLog.steps < dailyLog.stepGoal && activity.steps >= dailyLog.stepGoal) {
          stepGoalJustMet = true;
        }
      }

      // Sync to DailyLog
      await DailyLog.findOneAndUpdate(
        { userId, date },
        { 
          $set: { 
            caloriesBurnt: totalBurnt,
            steps: activity.steps 
          } 
        },
        { upsert: true }
      );
      
      if (stepGoalJustMet) {
        await NotificationService.sendPushNotification(
          userId, 
          "Step Goal Achieved! 🏃‍♂️", 
          `Awesome job hitting your ${dailyLog?.stepGoal} steps today!`, 
          { type: 'achievement' }
        );
      }
      
      return activity;
    } catch (error) {
      logger.error({ err: error, userId, date }, 'Failed to sync Activity to DailyLog');
      return null;
    }
  }
}
