import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName?: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: Date;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  bmr?: number;
  tdee?: number; // Total Daily Energy Expenditure
  subscriptionTier: 'free' | 'pro';
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'none';
  trialStartDate?: Date;
  trialEndsAt?: Date;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  planType?: 'monthly' | 'yearly';
  paymentId?: string;
  expoPushToken?: string;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dateOfBirth: { type: Date },
    heightCm: { type: Number },
    weightKg: { type: Number },
    activityLevel: { 
      type: String, 
      enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
      default: 'sedentary'
    },
    bmr: { type: Number },
    tdee: { type: Number },
    subscriptionTier: { type: String, enum: ['free', 'pro'], default: 'free' },
    subscriptionStatus: { 
      type: String, 
      enum: ['trial', 'active', 'expired', 'none'], 
      default: 'none' 
    },
    trialStartDate: { type: Date },
    trialEndsAt: { type: Date },
    subscriptionStartDate: { type: Date },
    subscriptionEndDate: { type: Date },
    planType: { type: String, enum: ['monthly', 'yearly'] },
    paymentId: { type: String },
    expoPushToken: { type: String },
    lastActiveAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.passwordHash) {
    const legacyPassword = this.get('password');
    if (legacyPassword) {
      return bcrypt.compare(candidatePassword, legacyPassword);
    }
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = model<IUser>('User', userSchema);
