export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new AppError(400, 'BAD_REQUEST', m);
export const unauthorized = (m = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'You do not have permission to do that') => new AppError(403, 'FORBIDDEN', m);
export const notFound = (m = 'Not found') => new AppError(404, 'NOT_FOUND', m);
export const conflict = (m: string) => new AppError(409, 'CONFLICT', m);
export const tooManyRequests = (m = 'Too many requests, slow down') => new AppError(429, 'RATE_LIMITED', m);
