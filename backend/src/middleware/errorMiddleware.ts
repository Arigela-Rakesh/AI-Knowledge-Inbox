import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });

  const typedError = err as { status?: number; expose?: boolean };
  const status = typedError.status ?? 500;
  const message = status < 500 || typedError.expose ? err.message : 'Internal server error';

  res.status(status).json({ success: false, error: message });
}
