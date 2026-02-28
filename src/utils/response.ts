import { Response } from 'express';

// ─── Response Helpers ─────────────────────────────────────────────────────────

export interface SuccessResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
}

export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
}

/**
 * Send a standardised success JSON response.
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
): void => {
  res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
  } satisfies SuccessResponse<T>);
};

/**
 * Send a standardised error JSON response.
 */
export const sendError = (
  res: Response,
  message = 'Internal Server Error',
  statusCode = 500,
): void => {
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  } satisfies ErrorResponse);
};
