import { Request, Response, NextFunction } from 'express';

// ─── Custom Application Error ─────────────────────────────────────────────────
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Global Error Handler Middleware ──────────────────────────────────────────
// Catches all errors forwarded via next(err) across the application.
export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const isDev = process.env.NODE_ENV === 'development';

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof Error ? err.message : 'Internal Server Error';
  const stack = err instanceof Error ? err.stack : undefined;

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(isDev && { stack }),
  });
};
