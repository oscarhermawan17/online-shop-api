import { Response } from 'express';

// ─── Response Helpers ─────────────────────────────────────────────────────────

export interface SuccessResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedSuccessResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T[];
  pagination: PaginationMeta;
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
 * Send a paginated success JSON response.
 */
export const sendPaginatedSuccess = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message = 'Success',
  statusCode = 200,
): void => {
  res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
    pagination,
  } satisfies PaginatedSuccessResponse<T>);
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
