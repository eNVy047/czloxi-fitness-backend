import { FastifyReply, FastifyRequest } from 'fastify';
import { registerSchema, RegisterInput, loginSchema, LoginInput, forgotPasswordSchema, ForgotPasswordInput } from './auth.schema';
import { AuthService } from './auth.service';
import { User } from '../../models/User';
import { sendCreated, sendSuccess } from '../../utils/response';
import { logger } from '../../utils/logger';

export class AuthController {
  static async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate request body
      const data: RegisterInput = registerSchema.parse(request.body);

      // Call service
      const user = await AuthService.registerUser(data);

      // Generate JWT
      const token = await reply.jwtSign({
        id: user._id.toString(),
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
      });

      // Send response without passwordHash
      const userData = {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
        trialUsed: user.trialUsed,
        scansToday: user.scansToday,
        trialEndsAt: user.trialEndsAt,
      };

      return sendCreated(reply, { user: userData, token }, 'User registered successfully');
    } catch (error) {
      logger.error({ err: error }, 'Error in AuthController.register');
      throw error; // Will be caught by global error handler
    }
  }

  static async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data: LoginInput = loginSchema.parse(request.body);
      
      const user = await AuthService.loginUser(data);

      const token = await reply.jwtSign({
        id: user._id.toString(),
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
      });

      const userData = {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
        trialUsed: user.trialUsed,
        scansToday: user.scansToday,
        trialEndsAt: user.trialEndsAt,
      };

      return reply.send({ success: true, message: 'Login successful', data: { user: userData, token } });
    } catch (error) {
      logger.error({ err: error }, 'Error in AuthController.login');
      throw error;
    }
  }

  static async logout(_request: FastifyRequest, reply: FastifyReply) {
    try {
      return sendSuccess(reply, null, 'Logged out successfully');
    } catch (error) {
      logger.error({ err: error }, 'Error in AuthController.logout');
      throw error;
    }
  }

  static async verifyToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const jwtUser = request.user as { id: string };
      const user = await User.findById(jwtUser.id).select('-passwordHash');

      if (!user) {
        return reply.status(401).send({ success: false, message: 'User not found' });
      }

      const userData = {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
        trialUsed: user.trialUsed,
        scansToday: user.scansToday,
        trialEndsAt: user.trialEndsAt,
      };

      return sendSuccess(reply, { user: userData }, 'Token is valid');
    } catch (error) {
      logger.error({ err: error }, 'Error in AuthController.verifyToken');
      throw error;
    }
  }
 
  static async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email }: ForgotPasswordInput = forgotPasswordSchema.parse(request.body);
      
      await AuthService.forgotPassword(email);

      return sendSuccess(reply, null, 'If your email is registered, we have sent you a temporary password.');
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return sendSuccess(reply, null, 'If your email is registered, we have sent you a temporary password.');
      }
      
      logger.error({ err: error }, 'Error in AuthController.forgotPassword');
      throw error;
    }
  }

  static async startTrial(request: FastifyRequest, reply: FastifyReply) {
    try {
      const jwtUser = request.user as { id: string };
      const user = await User.findById(jwtUser.id);

      if (!user) {
        return reply.status(404).send({ success: false, message: 'User not found' });
      }

      if (user.trialUsed) {
        return reply.status(400).send({ success: false, message: 'Trial has already been used on this account.' });
      }

      // Activate 7-day trial
      user.subscriptionStatus = 'trial';
      user.trialUsed = true;
      user.trialStartDate = new Date();
      user.trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await user.save();

      const userData = {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
        trialUsed: user.trialUsed,
        scansToday: user.scansToday,
        trialEndsAt: user.trialEndsAt,
      };

      return sendSuccess(reply, { user: userData }, 'Free trial activated! Enjoy your premium features for 7 days.');
    } catch (error) {
      logger.error({ err: error }, 'Error in AuthController.startTrial');
      throw error;
    }
  }
}
