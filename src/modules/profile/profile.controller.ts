import { FastifyReply, FastifyRequest } from 'fastify';
import { profileSetupSchema, ProfileSetupInput, profileUpdateSchema } from './profile.schema';
import { ProfileService } from './profile.service';
import { sendCreated, sendSuccess } from '../../utils/response';
import { logger } from '../../utils/logger';
import { v2 as cloudinary } from 'cloudinary';

import { UserProfile } from '../../models/UserProfile';
import { User } from '../../models/User';
import { DailyLog } from '../../models/DailyLog';
import { FoodScan } from '../../models/FoodScan';



export class ProfileController {
  static async setup(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Body Validation
      const data: ProfileSetupInput = profileSetupSchema.parse(request.body);

      // We expect the @fastify/jwt verify plugin to have populated request.user
      const userId = (request.user as any).id;

      const profile = await ProfileService.setupProfile(userId, data);

      return sendCreated(reply, { profile }, 'Profile setup successfully');
    } catch (error) {
      logger.error({ err: error }, 'Error in ProfileController.setup');
      throw error;
    }
  }

  static async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const data = await ProfileService.getProfile(userId);
      return sendSuccess(reply, data, 'Profile fetched successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error GET profile');
      throw error;
    }
  }

  static async getGoals(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { profile } = await ProfileService.getProfile(userId);
      if (!profile) {
        return reply.status(404).send({ success: false, message: 'Profile not found. Please setup profile first.' });
      }
      const goals = profile.goals || ProfileService.calculateGoals({
        age: profile.age,
        gender: profile.gender,
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        activityLevel: profile.activityLevel,
        fitnessGoal: profile.fitnessGoal,
        targetWeight: profile.targetWeight,
      });
      return sendSuccess(reply, goals, 'Goals fetched successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error GET profile/goals');
      throw error;
    }
  }

  static async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const parsedData = profileUpdateSchema.parse(request.body);
      const data = await ProfileService.updateProfile(userId, parsedData);
      return sendSuccess(reply, { ...data, goals: data.profile.goals }, 'Profile updated successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error PUT profile');
      throw error;
    }
  }

  static async uploadProfileImage(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Configure Cloudinary fresh at call time (so env vars are always read)
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
        api_key: process.env.CLOUDINARY_API_KEY || '',
        api_secret: process.env.CLOUDINARY_API_SECRET || '',
      });

      const userId = (request.user as any).id;
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ success: false, message: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'caloxi/profiles', public_id: `user_${userId}` },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(buffer);
      });

      const secureUrl = (uploadResult as any).secure_url;

      const profile = await UserProfile.findOne({ userId });
      if (profile) {
        profile.profileImage = secureUrl;
        await profile.save();
      }

      return sendSuccess(reply, { profileImage: secureUrl }, 'Profile image uploaded successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error POST profile/image');
      throw error;
    }
  }

  static async deleteAccount(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      
      await UserProfile.deleteOne({ userId });
      await DailyLog.deleteMany({ userId });
      await FoodScan.deleteMany({ userId });
      await User.deleteOne({ _id: userId });

      return sendSuccess(reply, null, 'Account deleted successfully');
    } catch (error) {
      logger.error({ err: error, user: request.user }, 'Error DELETE profile/account');
      throw error;
    }
  }
}
