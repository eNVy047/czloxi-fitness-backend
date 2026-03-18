import { FastifyReply, FastifyRequest } from 'fastify';
import { DashboardService } from './dashboard.service';
import { sendSuccess } from '../../utils/response';
import { logger } from '../../utils/logger';

export class DashboardController {
  static async getTodayLog(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const log = await DashboardService.getOrCreateTodayLog(userId);
      return sendSuccess(reply, { log }, 'Dashboard data fetched successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error GET dashboard/today');
      throw error;
    }
  }

  static async getDayLog(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { date } = request.query as { date?: string };

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.status(400).send({ success: false, message: 'Invalid or missing date. Use YYYY-MM-DD format.' });
      }

      const log = await DashboardService.getDayLog(userId, date);
      return sendSuccess(reply, { log }, 'Day log fetched successfully');
    } catch (error: any) {
      if (error?.message?.includes('future')) {
        return reply.status(400).send({ success: false, message: error.message });
      }
      logger.error({ err: error, user: request.user }, 'Error GET dashboard/day');
      throw error;
    }
  }

  static async getWeekLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const weekLogs = await DashboardService.getWeekLogs(userId);
      return sendSuccess(reply, { weekLogs }, 'Week logs fetched successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error GET dashboard/week');
      throw error;
    }
  }

  static async addWaterGlass(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const log = await DashboardService.addWaterGlass(userId);
      return sendSuccess(reply, { log }, 'Water incremented successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error PATCH dashboard/water');
      throw error;
    }
  }
}
