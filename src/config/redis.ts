import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times: number) => {
    if (times > 10) {
      logger.fatal('❌ Redis max retry attempts reached. Exiting.');
      process.exit(1);
    }
    const delay = Math.min(times * 200, 3000);
    logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting...');
    return delay;
  },
};

export const redis = new Redis(env.REDIS_URL, redisOptions);

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('ready', () => logger.info('✅ Redis ready'));
redis.on('error', (err: any) => logger.error({ err }, '❌ Redis error'));
redis.on('close', () => logger.warn('⚡ Redis connection closed'));
redis.on('reconnecting', () => logger.warn('⚡ Redis reconnecting...'));

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}
