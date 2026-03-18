import { Schema, model, Document, Types } from 'mongoose';

export interface IGoalsMeta {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  waterGlasses: number;
  stepGoal: number;
}

export interface IDailyLog extends Document {
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  caloriesConsumed: number;
  calorieGoal: number;
  fatConsumed: number;
  fatGoal: number;
  proteinConsumed: number;
  proteinGoal: number;
  carbsConsumed: number;
  carbsGoal: number;
  waterGlasses: number;
  waterGoal: number;
  steps: number;
  stepGoal: number;
  caloriesBurnt: number;
  sleepHours: number;
  sleepScore: number;
  bedtime?: string;
  wakeTime?: string;
  weightKg?: number;
  mood?: 'happy' | 'neutral' | 'sad' | 'angry' | 'tired';
  exerciseLogged: boolean;
  goalMet: boolean;
  goalsMeta: IGoalsMeta;
  createdAt: Date;
  updatedAt: Date;
}

const goalMetaSchema = new Schema<IGoalsMeta>({
  calorieGoal: { type: Number, default: 2000 },
  proteinGoal: { type: Number, default: 150 },
  carbsGoal: { type: Number, default: 200 },
  fatGoal: { type: Number, default: 67 },
  waterGlasses: { type: Number, default: 8 },
  stepGoal: { type: Number, default: 10000 },
}, { _id: false });

const dailyLogSchema = new Schema<IDailyLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    caloriesConsumed: { type: Number, default: 0 },
    calorieGoal: { type: Number, required: true, default: 2000 },
    fatConsumed: { type: Number, default: 0 },
    fatGoal: { type: Number, required: true, default: 67 },
    proteinConsumed: { type: Number, default: 0 },
    proteinGoal: { type: Number, required: true, default: 150 },
    carbsConsumed: { type: Number, default: 0 },
    carbsGoal: { type: Number, required: true, default: 200 },
    waterGlasses: { type: Number, default: 0 },
    waterGoal: { type: Number, default: 8 },
    steps: { type: Number, default: 0 },
    stepGoal: { type: Number, default: 10000 },
    caloriesBurnt: { type: Number, default: 0 },
    sleepHours: { type: Number, default: 0 },
    sleepScore: { type: Number, default: 0 },
    bedtime: { type: String },
    wakeTime: { type: String },
    weightKg: { type: Number },
    mood: { 
      type: String, 
      enum: ['happy', 'neutral', 'sad', 'angry', 'tired'] 
    },
    exerciseLogged: { type: Boolean, default: false },
    goalMet: { type: Boolean, default: false },
    goalsMeta: { type: goalMetaSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

// Ensure only one log exists per user, per day
dailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyLog = model<IDailyLog>('DailyLog', dailyLogSchema);
