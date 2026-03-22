import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Wrap an async operation with exponential backoff retries.
 * Respects 429 Rate Limits and transient 500 errors.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 500, backoffFactor = 2 } = options;
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxRetries) {
    try {
        return await operation();
    } catch (error: any) {
      attempt++;
      
      const status = error.response?.status;
      // Rethrow if it's not a transient error or rate limit
      if (status && status !== 429 && status < 500) {
        throw error;
      }

      if (attempt >= maxRetries) {
        logger.error(`Operation failed after ${maxRetries} attempts`);
        throw error;
      }

      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms... (Status: ${status || 'Network Error'})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= backoffFactor;
    }
  }
  throw new Error('Unreachable code');
}
