import { Schema, model, Document, Types } from 'mongoose';

export interface IActivityLog extends Document {
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  steps: number;
  stepCalories: number;
  totalCaloriesBurnt: number;
  activeMinutes: number;
  distance: number; // in km
  exercises: {
    _id?: Types.ObjectId;
    name: string;
    met: number;
    duration: number; // in minutes
    sets?: number;
    reps?: number;
    caloriesBurnt: number;
    isRoutine?: boolean;
    fromRoutine?: boolean;
  }[];
  sleepHours?: number;
  sleepScore?: number;
  bedtime?: string;
  wakeTime?: string;
  sleepQuality?: '😴' | '😐' | '😊';
  createdAt: Date;
  updatedAt: Date;
}

const exerciseSchema = new Schema({
  name: { type: String, required: true },
  met: { type: Number, required: true },
  duration: { type: Number, required: true },
  sets: { type: Number },
  reps: { type: Number },
  caloriesBurnt: { type: Number, required: true },
  isRoutine: { type: Boolean, default: false },
  fromRoutine: { type: Boolean, default: false },
});

const activityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    steps: { type: Number, default: 0 },
    stepCalories: { type: Number, default: 0 },
    totalCaloriesBurnt: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
    distance: { type: Number, default: 0 },
    exercises: [exerciseSchema],
    sleepHours: { type: Number },
    sleepScore: { type: Number },
    bedtime: { type: String },
    wakeTime: { type: String },
    sleepQuality: { type: String, enum: ['😴', '😐', '😊'] },
  },
  {
    timestamps: true,
  }
);

// Ensure only one log exists per user, per day
activityLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const ActivityLog = model<IActivityLog>('ActivityLog', activityLogSchema);
