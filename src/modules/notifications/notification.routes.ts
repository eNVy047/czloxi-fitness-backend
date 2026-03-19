import { FastifyInstance } from 'fastify';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  updatePushToken,
} from './notification.controller';

export default async function notificationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  
  // User Routes
  app.get('/', getNotifications);
  app.get('/unread-count', getUnreadCount);
  app.patch('/read-all', markAllAsRead);
  app.patch('/:id/read', markAsRead);
  app.patch('/push-token', updatePushToken);
  
  app.delete('/:id', deleteNotification);
}
