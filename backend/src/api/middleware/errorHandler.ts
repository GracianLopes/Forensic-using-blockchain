import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Bad request error
 */
export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack
  });

  // Handle known operational errors
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode
      }
    });
    return;
  }

  // Handle multer errors
  if (err.name === 'MulterError') {
    if (err.message.includes('File too large')) {
      res.status(400).json({
        success: false,
        error: {
          message: 'File too large. Maximum size is 100MB',
          statusCode: 400
        }
      });
      return;
    }
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
      statusCode: 500
    }
  });
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(
  req: Request,
  res: Response
): void {
  logger.warn('Route not found', { method: req.method, path: req.path });
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      statusCode: 404
    }
  });
}
