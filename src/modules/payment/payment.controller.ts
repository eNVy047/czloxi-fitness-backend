import { FastifyReply, FastifyRequest } from 'fastify';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../../config/env';
import { User } from '../../models/User';
import { Payment } from '../../models/Payment';
import { logger } from '../../utils/logger';
import { sendSuccess, sendError, sendCreated } from '../../utils/response';
import { z } from 'zod';

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || '',
  key_secret: env.RAZORPAY_KEY_SECRET || '',
});

export const createOrderSchema = z.object({
  planType: z.enum(['monthly', 'yearly']),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  planType: z.enum(['monthly', 'yearly']),
});

export class PaymentController {
  static async createOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: userId } = request.user as { id: string };
      const { planType } = createOrderSchema.parse(request.body);

      const amount = planType === 'monthly' ? 2900 : 29900; // ₹99 or ₹999 in paise
      const currency = 'INR';

      const options = {
        amount,
        currency,
        receipt: `r_${userId.toString().slice(-8)}_${Date.now()}`,
        notes: { userId, planType },
      };

      const order = await razorpay.orders.create(options);

      return sendCreated(reply, {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: env.RAZORPAY_KEY_ID,
      }, 'Order created successfully');
    } catch (error) {
      logger.error({ err: error }, 'Error in PaymentController.createOrder');
      return sendError(reply, 500, 'Failed to create order');
    }
  }

  static async verifyPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: userId } = request.user as { id: string };
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        planType
      } = verifyPaymentSchema.parse(request.body);

      const generated_signature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        return sendError(reply, 400, 'Invalid payment signature');
      }

      // Fetch order details from Razorpay to get amount and receipt
      const order = await razorpay.orders.fetch(razorpay_order_id);

      // Create success payment record only now
      const payment = await Payment.create({
        userId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        receipt: order.receipt,
        amount: Number(order.amount) / 100,
        currency: order.currency,
        status: 'success',
      });

      // Update user subscription
      const now = new Date();
      const durationDays = planType === 'monthly' ? 30 : 365;
      const endDate = new Date();
      endDate.setDate(now.getDate() + durationDays);

      await User.findByIdAndUpdate(userId, {
        subscriptionStatus: 'active',
        subscriptionTier: 'pro',
        subscriptionStartDate: now,
        subscriptionEndDate: endDate,
        planType,
        paymentId: razorpay_payment_id,
      });

      return sendSuccess(reply, { payment }, 'Payment verified and subscription activated');
    } catch (error) {
      logger.error({ err: error }, 'Error in PaymentController.verifyPayment');
      return sendError(reply, 500, 'Failed to verify payment');
    }
  }

  static async getStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: userId } = request.user as { id: string };
      const user = await User.findById(userId).select('subscriptionStatus subscriptionEndDate trialEndsAt');

      if (!user) {
        return sendError(reply, 401, 'User session invalid - user not found. Please log in again.');
      }

      return sendSuccess(reply, {
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
        trialEndsAt: user.trialEndsAt,
      }, 'Subscription status fetched');
    } catch (error) {
      logger.error({ err: error }, 'Error in PaymentController.getStatus');
      return sendError(reply, 500, 'Failed to fetch status');
    }
  }

  static async getHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: userId } = request.user as { id: string };
      const payments = await Payment.find({ userId }).sort({ createdAt: -1 });
      return sendSuccess(reply, { payments }, 'Payment history fetched');
    } catch (error) {
      logger.error({ err: error }, 'Error in PaymentController.getHistory');
      return sendError(reply, 500, 'Failed to fetch history');
    }
  }

  static async startTrial(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: userId } = request.user as { id: string };
      const user = await User.findById(userId);

      if (!user) {
        return sendError(reply, 401, 'User session invalid - user not found. Please log in again.');
      }

      if (user.subscriptionStatus !== 'none' || user.trialUsed) {
        return sendError(reply, 400, 'Trial has already been used or user is already subscribed');
      }

      const now = new Date();
      const trialEndsAt = new Date();
      trialEndsAt.setDate(now.getDate() + 7);

      user.subscriptionStatus = 'trial';
      user.subscriptionTier = 'pro';
      user.trialStartDate = now;
      user.trialEndsAt = trialEndsAt;
      user.trialUsed = true;
      await user.save();

      return sendSuccess(reply, {
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt
      }, 'Free trial started');
    } catch (error) {
      logger.error({ err: error }, 'Error in PaymentController.startTrial');
      return sendError(reply, 500, 'Failed to start trial');
    }
  }
}
