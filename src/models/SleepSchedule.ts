import { Schema, model, Document, Types } from 'mongoose';

export interface ISleepSchedule extends Document {
  userId: Types.ObjectId;
  defaultBedtime: string; // 'HH:mm' Format
  defaultWakeTime: string; // 'HH:mm' Format
  isDaily: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sleepScheduleSchema = new Schema<ISleepSchedule>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    defaultBedtime: { type: String, required: true },
    defaultWakeTime: { type: String, required: true },
    isDaily: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const SleepSchedule = model<ISleepSchedule>('SleepSchedule', sleepScheduleSchema);
