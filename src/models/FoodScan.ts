import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodScan extends Document {
  userId: mongoose.Types.ObjectId;
  image?: string;
  foodName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  description: string;
  ingredients: string[];
  type: 'eat' | 'test';
  scannedAt: Date;
  expiresAt?: Date | null;
}

const foodScanSchema = new Schema<IFoodScan>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    image: {
      type: String, // base64 or URL
    },
    foodName: {
      type: String,
      required: true,
    },
    calories: {
      type: Number,
      required: true,
    },
    protein: {
      type: Number,
      required: true,
    },
    fat: {
      type: Number,
      required: true,
    },
    carbs: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    ingredients: {
      type: [String],
      required: true,
    },
    type: {
      type: String,
      enum: ['eat', 'test'],
      required: true,
    },
    scannedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const FoodScan = mongoose.model<IFoodScan>('FoodScan', foodScanSchema);
