import { Schema, model, Document, Types } from 'mongoose';

export interface IUserGoals {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  waterGlasses: number;
  stepGoal: number;
  caloriesBurntGoal: number;
  sleepGoal: number;
}

export interface IUserProfile extends Document {
  userId: Types.ObjectId;
  age: number;
  gender: 'male' | 'female' | 'other';
  heightCm: number;
  weightKg: number;
  fitnessGoal: 'lose_weight' | 'build_muscle' | 'stay_fit';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  dietPreference: 'veg' | 'non_veg' | 'vegan';
  bmi: number;
  dailyCalories: number; // TDEE (Total Daily Energy Expenditure) based on Goal
  targetWeight?: number;
  workoutTimePreference: 'morning' | 'afternoon' | 'evening' | 'night' | 'flexible';
  goals?: IUserGoals;
  pushToken?: string;
  profileImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userProfileSchema = new Schema<IUserProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    heightCm: { type: Number, required: true },
    weightKg: { type: Number, required: true },
    fitnessGoal: { 
      type: String, 
      enum: ['lose_weight', 'build_muscle', 'stay_fit'], 
      required: true 
    },
    activityLevel: { 
      type: String, 
      enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
      required: true
    },
    dietPreference: { 
      type: String, 
      enum: ['veg', 'non_veg', 'vegan'], 
      required: true 
    },
    bmi: { type: Number, required: true },
    dailyCalories: { type: Number, required: true },
    targetWeight: { type: Number },
    workoutTimePreference: { 
      type: String, 
      enum: ['morning', 'afternoon', 'evening', 'night', 'flexible'],
      default: 'flexible'
    },
    goals: {
      calorieGoal: { type: Number },
      proteinGoal: { type: Number },
      carbsGoal: { type: Number },
      fatGoal: { type: Number },
      waterGlasses: { type: Number },
      stepGoal: { type: Number },
      caloriesBurntGoal: { type: Number },
      sleepGoal: { type: Number },
    },
    pushToken: { type: String },
    profileImage: { type: String },
  },
  {
    timestamps: true,
  }
);

export const UserProfile = model<IUserProfile>('UserProfile', userProfileSchema);
