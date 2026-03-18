import { FastifyInstance } from 'fastify';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from './notification.controller';

export default async function notificationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);
  app.get('/', getNotifications);
  app.patch('/read-all', markAllAsRead);
  app.patch('/:id/read', markAsRead);
  app.delete('/:id', deleteNotification);
}
