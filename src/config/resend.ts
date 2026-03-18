import { Resend } from 'resend';
import { env } from './env';

export const resend = new Resend(env.RESEND_API_KEY);

export const emailDefaults = {
  from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
};
