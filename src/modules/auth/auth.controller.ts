import { FastifyReply, FastifyRequest } from 'fastify';
import { registerSchema, RegisterInput, loginSchema, LoginInput } from './auth.schema';
import { AuthService } from './auth.service';
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
      };

      return sendCreated(reply, { user: userData, token }, 'User registered successfully');
    } catch (error) {
      logger.error({ err: error }, 'Error in AuthController.register');
      throw error; // Will be caught by global error handler
    }
  }

  static async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      console.log('--- LOGIN REQUEST STARTED ---');
      console.log('Request body:', request.body);
      const data: LoginInput = loginSchema.parse(request.body);
      
      console.log('Input validated:', data.email);
      const user = await AuthService.loginUser(data);
      console.log('User fetched and password matched! User ID:', user._id);

      const token = await reply.jwtSign({
        id: user._id.toString(),
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
      });
      console.log('JWT Token generated.');

      const userData = {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
      };

      console.log('Sending successful response.');
      return reply.send({ success: true, message: 'Login successful', data: { user: userData, token } });
    } catch (error) {
      console.error('--- LOGIN ERROR CAUGHT ---', error);
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
      // request.user is populated by fastify.authenticate middleware
      const jwtUser = request.user as { 
        id: string; 
        email: string; 
        subscriptionTier: string;
        subscriptionStatus: string;
      };
      return sendSuccess(reply, { user: jwtUser }, 'Token is valid');
    } catch (error) {
      logger.error({ err: error }, 'Error in AuthController.verifyToken');
      throw error;
    }
  }
}
