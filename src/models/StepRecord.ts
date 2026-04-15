import { Schema, model, Document, Types } from 'mongoose';

export interface IStepRecord extends Document {
  userId: Types.ObjectId;
  steps: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stepRecordSchema = new Schema<IStepRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    steps: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

// Create a compound index for efficient querying
stepRecordSchema.index({ userId: 1, timestamp: -1 });

export const StepRecord = model<IStepRecord>('StepRecord', stepRecordSchema);
