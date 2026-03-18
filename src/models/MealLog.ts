import { Schema, model, Document, Types } from 'mongoose';

export interface IMealLog extends Document {
  userId: Types.ObjectId;
  dailyLogId: Types.ObjectId;
  imageUrl?: string;
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  
  // Macros
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  
  // Detected ingredients
  ingredients: {
    name: string;
    amount?: string;
    calories?: number;
  }[];
  
  // AI Confidence
  aiConfidenceScore?: number; // 0-100
  source: 'gemini' | 'nutritionix' | 'manual';

  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mealLogSchema = new Schema<IMealLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dailyLogId: { type: Schema.Types.ObjectId, ref: 'DailyLog', required: true },
    imageUrl: { type: String },
    name: { type: String, required: true },
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
    
    calories: { type: Number, required: true, default: 0 },
    proteinGrams: { type: Number, required: true, default: 0 },
    carbsGrams: { type: Number, required: true, default: 0 },
    fatGrams: { type: Number, required: true, default: 0 },
    
    ingredients: [
      {
        name: { type: String, required: true },
        amount: { type: String },
        calories: { type: Number }
      }
    ],

    aiConfidenceScore: { type: Number, min: 0, max: 100 },
    source: { type: String, enum: ['gemini', 'nutritionix', 'manual'], default: 'manual' },
    
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const MealLog = model<IMealLog>('MealLog', mealLogSchema);
