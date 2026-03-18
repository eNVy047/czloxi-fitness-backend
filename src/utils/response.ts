import { FastifyReply } from 'fastify';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: Record<string, unknown>,
): FastifyReply {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  };
  return reply.status(statusCode).send(response);
}

export function sendCreated<T>(reply: FastifyReply, data: T, message = 'Created'): FastifyReply {
  return sendSuccess(reply, data, message, 201);
}

export function sendNoContent(reply: FastifyReply): FastifyReply {
  return reply.status(204).send();
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  errors?: unknown,
): FastifyReply {
  return reply.status(statusCode).send({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}

