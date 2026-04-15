import { adminLogin as authLogin } from './admin.auth';
import { User } from '../models/User';
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  sendAdminNotification,
  scheduleAdminNotification,
  getAdminNotificationHistory,
  getAdminNotificationStats,
  resendAdminNotification,
  deleteNotification as deleteNotificationController,
} from '../modules/notifications/notification.controller';

export const adminLogin = authLogin;

export const getUsers = async (_req: FastifyRequest, res: FastifyReply) => {
  try {
    const users = await User.find({}, 'email expoPushToken subscriptionStatus lastActiveAt createdAt')
      .sort({ createdAt: -1 })
      .limit(200);
    
    return res.status(200).send({ success: true, data: users });
  } catch (err) {
    return res.status(500).send({ success: false, message: "Internal server error" });
  }
};

export const sendNotification = sendAdminNotification;
export const scheduleNotification = scheduleAdminNotification;
export const getHistory = getAdminNotificationHistory;
export const getStats = getAdminNotificationStats;
export const resendNotification = resendAdminNotification;
export const deleteNotification = deleteNotificationController;
