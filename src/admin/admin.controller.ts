import { adminLogin as authLogin } from './admin.auth';
import {
  sendAdminNotification,
  scheduleAdminNotification,
  getAdminNotificationHistory,
  getAdminNotificationStats,
  resendAdminNotification,
  deleteNotification as deleteNotificationController,
} from '../modules/notifications/notification.controller';

export const adminLogin = authLogin;
export const sendNotification = sendAdminNotification;
export const scheduleNotification = scheduleAdminNotification;
export const getHistory = getAdminNotificationHistory;
export const getStats = getAdminNotificationStats;
export const resendNotification = resendAdminNotification;
export const deleteNotification = deleteNotificationController;
