import { FastifyReply, FastifyRequest } from 'fastify';
import { ActivityService } from './activity.service';
import { sendSuccess } from '../../utils/response';
import { logger } from '../../utils/logger';
import { z } from 'zod';

export class ActivityController {
  static async getTodayActivity(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const date = (request.query as any).date;
      const activity = await ActivityService.getOrCreateTodayActivity(userId, date);
      return sendSuccess(reply, activity, 'Activity fetched successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error GET activity/today');
      throw error;
    }
  }

  static async getActivityLog(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { date } = z.object({ date: z.string().optional() }).parse(request.query);
      const log = await ActivityService.getActivityLog(userId, date || new Date().toISOString().split('T')[0]);
      return sendSuccess(reply, log || { exercises: [], steps: 0, totalCaloriesBurnt: 0 }, 'Activity log fetched successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error GET activity/log');
      throw error;
    }
  }

  static async updateSteps(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { steps, date } = z.object({ 
        steps: z.number(),
        date: z.string().optional()
      }).parse(request.body);
      
      const activity = await ActivityService.updateSteps(userId, steps, date);
      return sendSuccess(reply, activity, 'Steps updated successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error PATCH activity/steps');
      throw error;
    }
  }

  static async logExercise(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const exerciseData = z.object({
        exerciseName: z.string(),
        duration: z.number(),
        sets: z.number().optional(),
        reps: z.number().optional(),
        isDaily: z.boolean().optional(),
        days: z.array(z.string()).optional(),
        date: z.string().optional(),
      }).parse(request.body);

      const activity = await ActivityService.logExercise(userId, {
        exerciseName: exerciseData.exerciseName,
        duration: exerciseData.duration,
        ...(exerciseData.sets !== undefined && { sets: exerciseData.sets }),
        ...(exerciseData.reps !== undefined && { reps: exerciseData.reps }),
        ...(exerciseData.isDaily !== undefined && { isDaily: exerciseData.isDaily }),
        ...(exerciseData.days !== undefined && { days: exerciseData.days }),
        ...(exerciseData.date !== undefined && { date: exerciseData.date }),
      });
      return sendSuccess(reply, activity, 'Exercise logged successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error POST activity/exercise');
      throw error;
    }
  }

  static async deleteExercise(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { id } = z.object({ id: z.string() }).parse(request.params);

      const activity = await ActivityService.deleteExercise(userId, id);
      return sendSuccess(reply, activity, 'Exercise deleted successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error DELETE activity/exercise');
      throw error;
    }
  }

  static async getLibrary(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const library = await ActivityService.getExerciseLibrary();
      return sendSuccess(reply, library, 'Exercise library fetched successfully');
    } catch (error) {
      logger.error({ err: error }, 'Error GET activity/library');
      throw error;
    }
  }

  // --- Sleep & Routine Handlers ---

  static async logSleep(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const sleepData = z.object({
        date: z.string(),
        bedtime: z.string(),
        wakeTime: z.string(),
        sleepHours: z.number(),
        sleepQuality: z.enum(['😴', '😐', '😊']).optional(),
        isDaily: z.boolean().optional(),
      }).parse(request.body);

      const activity = await ActivityService.logSleep(userId, sleepData.date, {
        bedtime: sleepData.bedtime,
        wakeTime: sleepData.wakeTime,
        sleepHours: sleepData.sleepHours,
        ...(sleepData.sleepQuality !== undefined && { sleepQuality: sleepData.sleepQuality as any }),
        ...(sleepData.isDaily !== undefined && { isDaily: sleepData.isDaily }),
      });
      return sendSuccess(reply, activity, 'Sleep logged successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error POST activity/sleep');
      throw error;
    }
  }

  static async getRoutine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const routine = await ActivityService.getRoutine(userId);
      return sendSuccess(reply, routine, 'Routine fetched successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error GET activity/routine');
      throw error;
    }
  }

  static async updateRoutine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const data = z.object({
        duration: z.number().optional(),
        days: z.array(z.string()).optional(),
      }).parse(request.body);

      const updateData: { duration?: number; days?: string[] } = {};
      if (data.duration !== undefined) updateData.duration = data.duration;
      if (data.days !== undefined) updateData.days = data.days;

      const routine = await ActivityService.updateRoutine(userId, id, updateData);
      return sendSuccess(reply, routine, 'Routine updated successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error PUT activity/routine');
      throw error;
    }
  }

  static async deleteRoutine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { id } = z.object({ id: z.string() }).parse(request.params);

      const routine = await ActivityService.deleteRoutine(userId, id);
      return sendSuccess(reply, routine, 'Routine deleted successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error DELETE activity/routine');
      throw error;
    }
  }

  static async workoutCheckin(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { done, remindLater } = z.object({
        done: z.boolean().optional(),
        remindLater: z.boolean().optional(),
      }).parse(request.body);

      const payload: { done?: boolean; remindLater?: boolean } = {};
      if (done !== undefined) payload.done = done;
      if (remindLater !== undefined) payload.remindLater = remindLater;

      const response = await ActivityService.workoutCheckin(userId, payload);
      return sendSuccess(reply, response, 'Workout checkin processed successfully');
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, message: 'Invalid checkin payload', errors: error.errors });
      }
      logger.error({ err: error, user: request.user }, 'Error PATCH activity/workout-checkin');
      throw error;
    }
  }
}
