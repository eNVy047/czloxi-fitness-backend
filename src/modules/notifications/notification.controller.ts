import { FastifyReply, FastifyRequest } from 'fastify';
import { Notification } from '../../models/Notification';
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
    const userId = request.user.id;

    const result = await Notification.findOneAndDelete({ _id: id, userId });

    if (!result) {
      return reply.status(404).send({ success: false, message: 'Notification not found' });
    }

    return reply.send({ success: true, message: 'Notification deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting notification');
    return reply.status(500).send({ success: false, message: 'Internal Server Error' });
  }
};
