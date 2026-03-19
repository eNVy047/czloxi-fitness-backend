import { FastifyInstance } from 'fastify';
import * as adminController from './admin.controller';
import { adminAuth as authMiddleware } from './admin.middleware';

export default async function adminRoutes(app: FastifyInstance) {
  // Login - Public
  app.post('/admin/login', adminController.adminLogin);
  
  // Protected Admin Routes
  app.post('/admin/notifications/send', { preHandler: [authMiddleware] }, adminController.sendNotification as any);
  app.post('/admin/notifications/schedule', { preHandler: [authMiddleware] }, adminController.scheduleNotification as any);
  app.get('/admin/notifications/history', { preHandler: [authMiddleware] }, adminController.getHistory as any);
  app.get('/admin/notifications/stats', { preHandler: [authMiddleware] }, adminController.getStats as any);
  app.post('/admin/notifications/:id/resend', { preHandler: [authMiddleware] }, adminController.resendNotification as any);
  app.delete('/admin/notifications/:id', { preHandler: [authMiddleware] }, adminController.deleteNotification as any);
}
