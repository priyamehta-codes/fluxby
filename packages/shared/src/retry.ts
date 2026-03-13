/**
 * Retry utility with exponential backoff
 *
 * Handles transient errors like:
 * - SQLITE_BUSY (concurrent access)
 * - NETWORK_ERROR
 * - TIMEOUT
 * - database is locked
 */

export interface RetryConfig {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 100) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 2000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  factor?: number;
  /** Custom condition to determine if error should be retried */
  retryIf?: (error: Error) => boolean;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  factor: 2,
  retryIf: () => true,
};

/**
 * Error patterns that are considered transient and should be retried.
 * These are common database/network errors that may succeed on subsequent attempts.
 */
const RETRYABLE_ERROR_PATTERNS = [
  'sqlite_busy',
  'network_error',
  'timeout',
  'lock_timeout',
  'database is locked',
  'disk i/o error',
  'closing writable stream',
  'cannot rollback',
  'connection refused',
  'econnreset',
  'etimedout',
];

/**
 * Check if an error is retryable based on known transient error patterns.
 *
 * @param error - The error to check
 * @returns true if the error matches a known retryable pattern
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return RETRYABLE_ERROR_PATTERNS.some(
    (pattern) => message.includes(pattern) || name.includes(pattern)
  );
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns The result of the function if successful
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * // Basic usage - retries retryable errors up to 3 times
 * const result = await withRetry(() => fetchData());
 *
 * // Custom config
 * const result = await withRetry(
 *   () => saveToDatabase(),
 *   { maxAttempts: 5, initialDelayMs: 50 }
 * );
 *
 * // Custom retry condition
 * const result = await withRetry(
 *   () => apiCall(),
 *   { retryIf: (err) => err.message.includes('rate limit') }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const opts = { ...DEFAULT_CONFIG, ...config };

  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const isCustomRetryable = opts.retryIf(lastError);
      const isPatternRetryable = isRetryableError(lastError);
      const shouldRetry = isCustomRetryable && isPatternRetryable;
      const hasMoreAttempts = attempt < opts.maxAttempts;

      if (!shouldRetry || !hasMoreAttempts) {
        throw lastError;
      }

      // Wait before retry with exponential backoff
      await sleep(delay);

      // Calculate next delay (exponential backoff with cap)
      delay = Math.min(delay * opts.factor, opts.maxDelayMs);
    }
  }

  // Should never reach here due to loop logic, but TypeScript needs it
  // We know lastError is set because loop must have run at least once with maxAttempts >= 1
  throw lastError ?? new Error('Retry failed: unknown error');
}
