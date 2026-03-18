import { Schema, model, Document } from 'mongoose';

export interface IExerciseLibrary extends Document {
  name: string;
  met: number;
  category: 'cardio' | 'strength' | 'flexibility';
  createdAt: Date;
  updatedAt: Date;
}

const exerciseLibrarySchema = new Schema<IExerciseLibrary>(
  {
    name: { type: String, required: true, unique: true },
    met: { type: Number, required: true },
    category: { type: String, enum: ['cardio', 'strength', 'flexibility'], required: true },
  },
  {
    timestamps: true,
  }
);

export const ExerciseLibrary = model<IExerciseLibrary>('ExerciseLibrary', exerciseLibrarySchema);
