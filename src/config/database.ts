import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

const MONGO_MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

let retries = 0;

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('connected', () => {
    logger.info('✅ MongoDB connected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, '❌ MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚡ MongoDB disconnected');
  });

  await attemptConnect();
}

async function attemptConnect(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    retries++;
    logger.warn({ attempt: retries, maxRetries: MONGO_MAX_RETRIES }, 'MongoDB connection failed, retrying...');

    if (retries >= MONGO_MAX_RETRIES) {
      logger.fatal('❌ Could not connect to MongoDB after max retries. Exiting.');
      process.exit(1);
    }

    await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    await attemptConnect();
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}
