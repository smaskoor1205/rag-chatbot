export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "APP_ERROR"
  ) {
    super(message);
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
