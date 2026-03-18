import { Schema, model, Document, Types } from 'mongoose';

export interface IExerciseRoutine extends Document {
  userId: Types.ObjectId;
  exerciseName: string;
  met: number;
  duration: number; // in minutes
  sets?: number;
  reps?: number;
  days: string[]; // e.g. ['mon', 'wed', 'fri']
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const exerciseRoutineSchema = new Schema<IExerciseRoutine>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exerciseName: { type: String, required: true },
    met: { type: Number, required: true },
    duration: { type: Number, required: true },
    sets: { type: Number },
    reps: { type: Number },
    days: [{ type: String, enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }],
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
  }
);

export const ExerciseRoutine = model<IExerciseRoutine>('ExerciseRoutine', exerciseRoutineSchema);
