import { UserProfile, IUserProfile } from '../../models/UserProfile';
import { User } from '../../models/User';
import { DailyLog } from '../../models/DailyLog';
import { ProfileSetupInput, ProfileUpdateInput } from './profile.schema';
import { ConflictError, NotFoundError } from '../../utils/errors';
import * as GoalService from './goalService';
import { format } from 'date-fns';

export class ProfileService {
  /**
   * (Legacy) Calculate all dynamic user goals from profile
   * Redirects to GoalService
   */
  static calculateGoals(profile: {
    age: number;
    gender: string;
    weightKg: number;
    heightCm: number;
    activityLevel: string;
    fitnessGoal: string;
    targetWeight?: number | undefined;
  }) {
    return GoalService.calculateGoals(profile);
  }

  static async setupProfile(userId: string, data: ProfileSetupInput): Promise<IUserProfile> {
    // 1. Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // 2. Check if a profile already exists
    const existingProfile = await UserProfile.findOne({ userId });
    if (existingProfile) {
      throw new ConflictError('Profile already exists for this user. Use the update endpoint instead.');
    }

    // 3. Compute derived values
    const results = GoalService.calculateGoals({
      age: data.age,
      gender: data.gender,
      weightKg: data.weightKg,
      heightCm: data.heightCm,
      activityLevel: data.activityLevel,
      fitnessGoal: data.fitnessGoal,
      targetWeight: data.targetWeight,
    });

    const { bmi, bmr, tdee, ...goals } = results;

    // 4. Create and save profile

    const profile = new UserProfile({
      userId,
      ...data,
      bmi,
      dailyCalories: tdee,
      targetWeight: data.targetWeight,
      workoutTimePreference: data.workoutTimePreference || 'flexible',
      goals,
    });

    await profile.save();

    // 5. Also sync core metrics back up to the User document for easier top-level querying
    user.gender = data.gender;
    user.heightCm = data.heightCm;
    user.weightKg = data.weightKg;
    user.activityLevel = data.activityLevel;
    user.bmr = bmr;
    user.tdee = tdee;
    await user.save();

    return profile;
  }

  static async getProfile(userId: string) {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const profile = await UserProfile.findOne({ userId });
    return { user, profile };
  }

  static async updateProfile(userId: string, data: ProfileUpdateInput) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      throw new NotFoundError('Profile not found. Please setup profile first.');
    }

    // Update simple fields on User model
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.gender !== undefined) user.gender = data.gender;
    if (data.heightCm !== undefined) user.heightCm = data.heightCm;
    if (data.weightKg !== undefined) user.weightKg = data.weightKg;
    if (data.activityLevel !== undefined) user.activityLevel = data.activityLevel;

    // Update simple fields on Profile model
    if (data.age !== undefined) profile.age = data.age;
    if (data.gender !== undefined) profile.gender = data.gender;
    if (data.heightCm !== undefined) profile.heightCm = data.heightCm;
    if (data.weightKg !== undefined) profile.weightKg = data.weightKg;
    if (data.fitnessGoal !== undefined) profile.fitnessGoal = data.fitnessGoal;
    if (data.activityLevel !== undefined) profile.activityLevel = data.activityLevel;
    if (data.dietPreference !== undefined) profile.dietPreference = data.dietPreference;
    if (data.targetWeight !== undefined) profile.targetWeight = data.targetWeight;
    if (data.workoutTimePreference !== undefined) profile.workoutTimePreference = data.workoutTimePreference;
    if (data.pushToken !== undefined) profile.pushToken = data.pushToken;

    // Recalculate BMI & TDEE if physical stats changed
    if (
      data.weightKg !== undefined ||
      data.heightCm !== undefined ||
      data.age !== undefined ||
      data.gender !== undefined ||
      data.activityLevel !== undefined ||
      data.fitnessGoal !== undefined ||
      data.targetWeight !== undefined
    ) {
      const results = GoalService.calculateGoals({
        age: profile.age,
        gender: profile.gender,
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        activityLevel: profile.activityLevel,
        fitnessGoal: profile.fitnessGoal,
        targetWeight: profile.targetWeight,
      });

      const { bmi, bmr, tdee, ...goals } = results;

      profile.bmi = bmi;
      profile.dailyCalories = tdee;
      profile.goals = goals;

      user.bmr = bmr;
      user.tdee = tdee;

      // Update today's DailyLog if it exists
      const today = format(new Date(), 'yyyy-MM-dd');
      const dailyLog = await DailyLog.findOne({ userId, date: today });
      if (dailyLog) {
        dailyLog.calorieGoal = goals.calorieGoal;
        dailyLog.proteinGoal = goals.proteinGoal;
        dailyLog.carbsGoal = goals.carbsGoal;
        dailyLog.fatGoal = goals.fatGoal;
        dailyLog.waterGoal = goals.waterGlasses;
        dailyLog.stepGoal = goals.stepGoal;
        
        dailyLog.goalsMeta = {
          calorieGoal: goals.calorieGoal,
          proteinGoal: goals.proteinGoal,
          carbsGoal: goals.carbsGoal,
          fatGoal: goals.fatGoal,
          waterGlasses: goals.waterGlasses,
          stepGoal: goals.stepGoal,
        };
        await dailyLog.save();
      }
    }

    await user.save();
    await profile.save();

    return { user, profile };
  }
}
