import { FastifyReply, FastifyRequest } from 'fastify';
import { Notification } from '../../models/Notification';
import { User } from '../../models/User';
import { NotificationService } from './notification.service';
import { logger } from '../../utils/logger';

export const getNotifications = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
    
    return reply.send({
      success: true,
      data: notifications,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching notifications');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

export const getUnreadCount = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    const count = await Notification.countDocuments({ userId, isRead: false });
    
    return reply.send({
      success: true,
      count,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching unread count');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

export interface SendNotificationBody {
  title: string;
  message: string;
  type?: string;
  targetType: 'all' | 'selected' | 'filter';
  targetUserIds?: string[];
  targetFilter?: {
    subscriptionStatus?: string[];
    fitnessGoal?: string[];
    inactiveDays?: number;
  };
}

export interface ScheduleNotificationBody extends SendNotificationBody {
  scheduledAt: string;
}

export interface NotificationHistoryQuery {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}

// Admin: Send Notification Now
export const sendAdminNotification = async (request: FastifyRequest<{ Body: SendNotificationBody }>, reply: FastifyReply) => {
  try {
    const { title, message, type, targetType, targetUserIds, targetFilter } = request.body;
    
    const notification = await Notification.create({
      title,
      message,
      type: type || 'general',
      targetType,
      targetUserIds,
      targetFilter,
      status: 'pending',
      createdBy: (request as any).admin ? (request as any).admin.id : (request as any).user?.id
    });

    // Fire and forget bulk sending
    NotificationService.sendBulk((notification._id as any).toString()).catch(err => {
      logger.error({ err, notificationId: notification._id }, 'Error in async sendBulk');
    });

    return reply.send({ success: true, data: notification });
  } catch (error) {
    logger.error({ err: error }, 'Error sending admin notification');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

// Admin: Schedule Notification
export const scheduleAdminNotification = async (request: FastifyRequest<{ Body: ScheduleNotificationBody }>, reply: FastifyReply) => {
  try {
    const { title, message, type, targetType, targetUserIds, targetFilter, scheduledAt } = request.body;
    
    const notification = await Notification.create({
      title,
      message,
      type: type || 'general',
      targetType,
      targetUserIds,
      targetFilter,
      status: 'scheduled',
      scheduledAt: new Date(scheduledAt),
      createdBy: (request as any).admin ? (request as any).admin.id : (request as any).user?.id
    });

    return reply.send({ success: true, data: notification });
  } catch (error) {
    logger.error({ err: error }, 'Error scheduling admin notification');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

// Admin: Get Notification History
export const getAdminNotificationHistory = async (request: FastifyRequest<{ Querystring: NotificationHistoryQuery }>, reply: FastifyReply) => {
  try {
    const { page = 1, limit = 10, type, status } = request.query;
    // Admin notifications have a targetType
    const query: any = { targetType: { $exists: true } };
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [notifications, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments(query)
    ]);

    return reply.send({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching admin notification history');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

// Admin: Get Stats
export const getAdminNotificationStats = async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    const stats = await Notification.aggregate([
      { $match: { createdBy: { $exists: true } } },
      {
        $group: {
          _id: null,
          totalSent: { $sum: '$totalSent' },
          delivered: { $sum: '$delivered' },
          failed: { $sum: '$failed' },
          scheduled: {
            $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || { totalSent: 0, delivered: 0, failed: 0, scheduled: 0 };
    return reply.send({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching admin notification stats');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

// Admin: Resend Notification
export const resendAdminNotification = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { id } = request.params;
    const original = await Notification.findById(id);
    if (!original) {
      return reply.status(404).send({ success: false, message: 'Notification not found' });
    }

    const resend = await Notification.create({
      title: original.title,
      message: original.message,
      type: original.type,
      targetType: original.targetType,
      targetUserIds: original.targetUserIds,
      targetFilter: original.targetFilter,
      status: 'pending',
      createdBy: (request as any).admin ? undefined : (request as any).user?.id
    });

    NotificationService.sendBulk((resend._id as any).toString()).catch(err => {
      logger.error({ err, notificationId: resend._id }, 'Error in resend bulk');
    });

    return reply.send({ success: true, data: resend });
  } catch (error) {
    logger.error({ err: error }, 'Error resending notification');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

// User: Update Push Token
export const updatePushToken = async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    const { token } = request.body;

    await User.findByIdAndUpdate(userId, { expoPushToken: token });

    return reply.send({ success: true, message: 'Push token updated successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Error updating push token');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

export const markAsRead = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return reply.status(404).send({ success: false, message: 'Notification not found' });
    }

    return reply.send({ success: true, data: notification });
  } catch (error) {
    logger.error({ err: error }, 'Error marking notification as read');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

export const markAllAsRead = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = request.user.id;
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
    
    return reply.send({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    logger.error({ err: error }, 'Error marking all notifications as read');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};

export const deleteNotification = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
  try {
    const { id } = request.params;
    const isAdmin = !!(request as any).admin;
    const userId = (request as any).user?.id;

    const notification = await Notification.findById(id);
    if (!notification) {
      return reply.status(404).send({ success: false, message: 'Notification not found' });
    }

    // Allow deleting if user is admin OR if it's the user's own notification
    if (!isAdmin && notification.userId && notification.userId.toString() !== userId) {
      return reply.status(403).send({ success: false, message: 'Unauthorized' });
    }

    await Notification.findByIdAndDelete(id);

    return reply.send({ success: true, message: 'Notification deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting notification');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};
