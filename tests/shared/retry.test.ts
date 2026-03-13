import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, isRetryableError } from '../../packages/shared/src/retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
      .mockResolvedValue('success');

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable error', async () => {
    vi.useRealTimers(); // Use real timers for rejection tests
    const fn = vi.fn().mockRejectedValue(new Error('Invalid SQL syntax'));

    await expect(withRetry(fn)).rejects.toThrow('Invalid SQL syntax');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
  });

  it('should respect maxAttempts', async () => {
    vi.useRealTimers(); // Use real timers for rejection tests
    const fn = vi.fn().mockRejectedValue(new Error('SQLITE_BUSY'));

    await expect(
      withRetry(fn, { maxAttempts: 2, initialDelayMs: 10 })
    ).rejects.toThrow('SQLITE_BUSY');
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useFakeTimers();
  });

  it('should use exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
      .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      factor: 2,
    });

    // First call fails immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 100ms delay, second call
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // After 200ms delay (100 * 2), third call
    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe('success');
  });

  it('should cap delay at maxDelayMs', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
      .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
      .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, {
      maxAttempts: 4,
      initialDelayMs: 500,
      factor: 10,
      maxDelayMs: 1000,
    });

    // First call fails immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 500ms delay, second call
    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(2);

    // After 1000ms delay (capped from 5000), third call
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(3);

    // After 1000ms delay (still capped), fourth call
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(4);

    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('success');
  });

  it('should use custom retryIf condition', async () => {
    vi.useRealTimers(); // Use real timers for rejection tests
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('custom retryable error'))
      .mockResolvedValue('success');

    // retryIf returns true but isRetryableError returns false, so no retry
    await expect(
      withRetry(fn, {
        retryIf: (err) => err.message.includes('custom retryable'),
      })
    ).rejects.toThrow('custom retryable error');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
  });

  it('should retry when both retryIf and isRetryableError return true', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, {
      retryIf: () => true,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should convert non-Error throws to Error', async () => {
    vi.useRealTimers(); // Use real timers for rejection tests
    const fn = vi.fn().mockRejectedValue('string error');

    await expect(withRetry(fn)).rejects.toThrow('string error');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
  });

  it('should handle multiple retries before success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('isRetryableError', () => {
  describe('should identify retryable errors', () => {
    it.each([
      ['SQLITE_BUSY', 'SQLITE_BUSY error'],
      ['sqlite_busy', 'sqlite_busy (lowercase)'],
      ['NETWORK_ERROR', 'NETWORK_ERROR'],
      ['network_error', 'network_error (lowercase)'],
      ['TIMEOUT', 'TIMEOUT'],
      ['timeout', 'timeout (lowercase)'],
      ['Operation timeout', 'Operation timeout'],
      ['LOCK_TIMEOUT', 'LOCK_TIMEOUT'],
      ['database is locked', 'database is locked'],
      ['disk I/O error', 'disk I/O error'],
      ['closing writable stream', 'closing writable stream'],
      ['cannot rollback', 'cannot rollback'],
      ['connection refused', 'connection refused'],
      ['ECONNRESET', 'ECONNRESET'],
      ['ETIMEDOUT', 'ETIMEDOUT'],
    ])('%s should be retryable', (message) => {
      expect(isRetryableError(new Error(message))).toBe(true);
    });
  });

  describe('should NOT identify non-retryable errors', () => {
    it.each([
      ['Syntax error', 'Syntax error'],
      ['Invalid SQL', 'Invalid SQL'],
      ['Column not found', 'Column not found'],
      ['Foreign key constraint failed', 'Foreign key constraint failed'],
      ['Unique constraint violated', 'Unique constraint violated'],
      ['Permission denied', 'Permission denied'],
      ['Invalid argument', 'Invalid argument'],
    ])('%s should NOT be retryable', (message) => {
      expect(isRetryableError(new Error(message))).toBe(false);
    });
  });

  it('should check error name as well as message', () => {
    const error = new Error('Some generic message');
    error.name = 'TimeoutError';
    expect(isRetryableError(error)).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isRetryableError(new Error('DATABASE IS LOCKED'))).toBe(true);
    expect(isRetryableError(new Error('Database Is Locked'))).toBe(true);
  });
});
