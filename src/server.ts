import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';

async function startServer() {
  try {
    // 1. Connect to Database & Cache
    await connectDatabase();
    // Redis is connected implicitly via config/redis.ts initialization

    // 2. Build App
    const app = await buildApp();

    // 3. Start Listening
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`🚀 Server running on http://${env.HOST}:${env.PORT}`);

    // 4. Graceful Shutdown handlers
    const signals = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        await app.close();
        await disconnectDatabase();
        await disconnectRedis();
        process.exit(0);
      });
    }
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

void startServer();
