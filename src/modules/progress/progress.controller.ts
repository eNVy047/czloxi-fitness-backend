import { FastifyReply, FastifyRequest } from 'fastify';
import { DailyLog } from '../../models/DailyLog';
import { logger } from '../../utils/logger';
import { startOfDay, subDays, startOfMonth, startOfYear, format } from 'date-fns';

export const getProgress = async (request: FastifyRequest<{ Querystring: { filter: string } }>, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    const { filter = 'today' } = request.query;
    const now = new Date();

    // Calculate Streak first, independent of filter
    const allLogs = await DailyLog.find({ userId }).sort({ date: -1 });
    let currentStreak = 0;
    let bestStreak = 0;
    
    // Current Streak logic
    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');
    
    let checkDate = todayStr;
    for (const log of allLogs) {
      if (log.date === checkDate && log.goalMet) {
        currentStreak++;
        checkDate = format(subDays(new Date(checkDate), 1), 'yyyy-MM-dd');
      } else if (log.date === yesterdayStr && !allLogs.find(l => l.date === todayStr)) {
        continue;
      } else {
        break;
      }
    }

    // Best Streak logic
    const sortedLogs = [...allLogs].sort((a, b) => a.date.localeCompare(b.date));
    let tempStreak = 0;
    let lastDate: string | null = null;
    for (const log of sortedLogs) {
      if (log.goalMet) {
        if (!lastDate || format(subDays(new Date(log.date), 1), 'yyyy-MM-dd') === lastDate) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
        bestStreak = Math.max(bestStreak, tempStreak);
        lastDate = log.date;
      } else {
        tempStreak = 0;
        lastDate = log.date;
      }
    }

    let resultData: any = { filter, summary: { currentStreak, bestStreak } };

    if (filter === 'year') {
      const yearStartStr = format(startOfYear(now), 'yyyy-MM-dd');
      const yearEndStr = format(now, 'yyyy-MM-dd');

      const aggLogs = await DailyLog.aggregate([
        { $match: { userId: new (require('mongoose').Types.ObjectId)(userId), date: { $gte: yearStartStr, $lte: yearEndStr } } },
        {
          $group: {
            _id: { $substrCP: ['$date', 0, 7] }, // Group by YYYY-MM
            avgCalories: { $avg: '$caloriesConsumed' },
            avgSteps: { $avg: '$steps' },
            avgSleep: { $avg: '$sleepHours' },
            avgWater: { $avg: '$waterGlasses' },
            avgWeight: { $avg: '$weightKg' }, // Taking average weight per month for the chart
            totalSteps: { $sum: '$steps' },
            docs: { $push: '$$ROOT' } // Keep docs to find the month-end weight if needed
          }
        },
        { $sort: { '_id': 1 } }
      ]);

      const formattedYearLogs = aggLogs.map(m => {
        // Find latest weight in that month for `weightAtMonthEnd` if needed
        const sortedDocs = m.docs.sort((a: any, b: any) => b.date.localeCompare(a.date));
        const latestDocWithWeight = sortedDocs.find((d: any) => d.weightKg != null);
        return {
          month: m._id,
          avgCalories: Math.round(m.avgCalories || 0),
          avgSteps: Math.round(m.avgSteps || 0),
          avgSleep: Number((m.avgSleep || 0).toFixed(1)),
          avgWater: Math.round(m.avgWater || 0),
          avgWeight: m.avgWeight,
          totalSteps: m.totalSteps || 0,
          weightAtMonthEnd: latestDocWithWeight ? latestDocWithWeight.weightKg : null,
        };
      });

      resultData.logs = formattedYearLogs;
    } else {
      let startDate: Date;
      switch (filter) {
        case 'week':
          startDate = subDays(now, 6); // Last 7 days including today
          break;
        case 'month':
          startDate = startOfMonth(now);
          break;
        case 'today':
        default:
          startDate = startOfDay(now);
      }

      const logs = await DailyLog.find({
        userId,
        date: { $gte: format(startDate, 'yyyy-MM-dd'), $lte: format(now, 'yyyy-MM-dd') }
      }).sort({ date: 1 });

      resultData.logs = logs;
    }

    return reply.send({
      success: true,
      data: resultData
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching progress data');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

export const logSleep = async (request: FastifyRequest<{ Body: { date: string, bedtime: string, wakeTime: string } }>, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    const { date, bedtime, wakeTime } = request.body;

    // Simple duration calculation (assume they sleep across midnight)
    const [bH, bM] = bedtime.split(':').map(Number);
    const [wH, wM] = wakeTime.split(':').map(Number);
    
    let sleepHours = wH - bH + (wM - bM) / 60;
    if (sleepHours < 0) sleepHours += 24;

    const sleepScore = Math.min(Math.round((sleepHours / 8) * 100), 100);

    const log = await DailyLog.findOneAndUpdate(
      { userId, date },
      { 
        bedtime, 
        wakeTime, 
        sleepHours: Number(sleepHours.toFixed(2)), 
        sleepScore 
      },
      { new: true, upsert: false }
    );

    if (!log) {
      return reply.status(404).send({ success: false, message: 'Daily log not found for this date' });
    }

    return reply.send({ success: true, data: log });
  } catch (error) {
    logger.error({ err: error }, 'Error logging sleep');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

export const logMood = async (request: FastifyRequest<{ Body: { date: string, mood: string } }>, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    const { date, mood } = request.body;

    const log = await DailyLog.findOneAndUpdate(
      { userId, date },
      { mood },
      { new: true, upsert: false }
    );

    if (!log) {
      return reply.status(404).send({ success: false, message: 'Daily log not found for this date' });
    }

    return reply.send({ success: true, data: log });
  } catch (error) {
    logger.error({ err: error }, 'Error logging mood');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};
