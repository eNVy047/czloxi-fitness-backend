import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { User } from '../src/models/User';

async function clearFcmTokens() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('Clearing fcmToken from all users...');
    const result = await User.updateMany({}, { $unset: { fcmToken: 1 } });
    console.log(`✅ Success! Updated ${result.modifiedCount} users.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing tokens:', error);
    process.exit(1);
  }
}

clearFcmTokens();
