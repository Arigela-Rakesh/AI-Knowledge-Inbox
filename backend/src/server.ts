import { config } from './config';
import { logger } from './utils/logger';
import { initDb } from './app';
import app from './app';

async function start() {
  await initDb();
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`, { env: config.nodeEnv });
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
