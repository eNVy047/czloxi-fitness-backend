import { z } from 'zod';

export const profileSetupSchema = z.object({
  age: z.number().min(10, 'Age must be at least 10').max(120, 'Age must be less than 120'),
  gender: z.enum(['male', 'female', 'other']),
  heightCm: z.number().min(50, 'Height must be at least 50cm').max(300, 'Height must be realistically less than 300cm'),
  weightKg: z.number().min(20, 'Weight must be at least 20kg').max(500, 'Weight must be realistically less than 500kg'),
  fitnessGoal: z.enum(['lose_weight', 'build_muscle', 'stay_fit']),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  dietPreference: z.enum(['veg', 'non_veg', 'vegan']),
  targetWeight: z.number().min(20, 'Target weight must be at least 20kg').max(500, 'Target weight must be less than 500kg').optional(),
  workoutTimePreference: z.enum(['morning', 'afternoon', 'evening', 'night', 'flexible']).default('flexible'),
  pushToken: z.string().optional(),
});

export type ProfileSetupInput = z.infer<typeof profileSetupSchema>;

export const profileUpdateSchema = profileSetupSchema.partial().extend({
  fullName: z.string().optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
