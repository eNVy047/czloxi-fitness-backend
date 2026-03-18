import mongoose from 'mongoose';
import { ExerciseLibrary } from './src/models/ExerciseLibrary';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/caloxi";

const exerciseSeeds = [
  { name: 'Running (Moderate)', met: 9.8, category: 'cardio' },
  { name: 'Running (Fast)', met: 11.5, category: 'cardio' },
  { name: 'Cycling (Moderate)', met: 7.5, category: 'cardio' },
  { name: 'Cycling (Fast)', met: 10.0, category: 'cardio' },
  { name: 'Walking (Brisk)', met: 4.3, category: 'cardio' },
  { name: 'Swimming (Freestyle)', met: 8.0, category: 'cardio' },
  { name: 'Yoga (Hatha)', met: 3.0, category: 'flexibility' },
  { name: 'Push ups', met: 3.8, category: 'strength' },
  { name: 'Sit ups', met: 3.8, category: 'strength' },
  { name: 'Weight Lifting (Heavy)', met: 6.0, category: 'strength' },
  { name: 'HIIT Workout', met: 8.0, category: 'cardio' },
  { name: 'Pilates', met: 3.0, category: 'flexibility' },
  { name: 'Stretching', met: 2.3, category: 'flexibility' },
  { name: 'Plank', met: 3.0, category: 'strength' },
];

async function seedExercises() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    
    console.log('🧹 Clearing existing exercise library...');
    await ExerciseLibrary.deleteMany({});
    
    console.log(`📦 Seeding ${exerciseSeeds.length} exercises...`);
    await ExerciseLibrary.insertMany(exerciseSeeds);
    
    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedExercises();
