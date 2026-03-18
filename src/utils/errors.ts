import { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from './logger';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 422);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

export function errorHandler(
  error: Error | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Zod validation errors
  if (error instanceof ZodError) {
    void reply.status(422).send({
      success: false,
      message: 'Validation failed',
      errors: error.flatten().fieldErrors,
    });
    return;
  }

  // Known operational errors
  if (error instanceof AppError) {
    logger.warn({ err: error, url: request.url }, error.message);
    void reply.status(error.statusCode).send({
      success: false,
      message: error.message,
    });
    return;
  }

  // Fastify schema validation errors
  if ((error as { statusCode?: number }).statusCode === 400) {
    void reply.status(400).send({
      success: false,
      message: error.message,
    });
    return;
  }

  // Unknown errors
  logger.error({ err: error, url: request.url }, 'Unexpected error');
  void reply.status(500).send({
    success: false,
    message: 'Internal server error',
  });
}
