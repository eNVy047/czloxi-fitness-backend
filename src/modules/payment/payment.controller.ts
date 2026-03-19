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

      const amount = planType === 'monthly' ? 9900 : 99900; // ₹99 or ₹999 in paise
      const currency = 'INR';

      const options = {
        amount,
        currency,
        receipt: `r_${userId.toString().slice(-8)}_${Date.now()}`,
        notes: { userId, planType },
      };

      const order = await razorpay.orders.create(options);

      // Create pending payment record
      await Payment.create({
        userId,
        razorpayOrderId: order.id,
        receipt: options.receipt,
        amount: amount / 100,
        currency,
        status: 'pending',
      });

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
        // Update payment status to failed
        await Payment.findOneAndUpdate(
          { razorpayOrderId: razorpay_order_id },
          { status: 'failed', razorpayPaymentId: razorpay_payment_id }
        );
        return sendError(reply, 400, 'Invalid payment signature');
      }

      // Update payment record
      const payment = await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { status: 'success', razorpayPaymentId: razorpay_payment_id },
        { new: true }
      );

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
        return sendError(reply, 404, 'User not found');
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
        return sendError(reply, 404, 'User not found');
      }

      if (user.subscriptionStatus !== 'none' || user.trialStartDate) {
        return sendError(reply, 400, 'Trial already started or user already subscribed');
      }

      const now = new Date();
      const trialEndsAt = new Date();
      trialEndsAt.setDate(now.getDate() + 7);

      user.subscriptionStatus = 'trial';
      user.trialStartDate = now;
      user.trialEndsAt = trialEndsAt;
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
