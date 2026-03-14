/**
 * Rate Limiting Middleware
 *
 * NOTE: Default memory store is NOT shared across Node.js cluster workers.
 * For clustered deployments, configure an external store (e.g., rate-limit-redis).
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiting middleware configuration for the Fluxby API.
 *
 * Environment Variables:
 * - RATE_LIMIT_WINDOW_MS: Global rate limit window in milliseconds (default: 900000 = 15 minutes)
 * - RATE_LIMIT_MAX_REQUESTS: Global max requests per window (default: 100)
 * - RATE_LIMIT_SENSITIVE_WINDOW_MS: Sensitive endpoints window in ms (default: 60000 = 1 minute)
 * - RATE_LIMIT_SENSITIVE_MAX_REQUESTS: Sensitive endpoints max requests (default: 10)
 *
 * Headers returned:
 * - RateLimit-Limit: Maximum requests allowed in window
 * - RateLimit-Remaining: Remaining requests in current window
 * - RateLimit-Reset: Unix timestamp when the rate limit resets
 */

// Parse environment variables with defaults (|| fallback handles NaN from invalid input)
const globalWindowMs =
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) || 900000; // 15 minutes
const globalMaxRequests =
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10) || 100;
const sensitiveWindowMs =
  parseInt(process.env.RATE_LIMIT_SENSITIVE_WINDOW_MS || '60000', 10) || 60000; // 1 minute
const sensitiveMaxRequests =
  parseInt(process.env.RATE_LIMIT_SENSITIVE_MAX_REQUESTS || '10', 10) || 10;

/**
 * Global rate limiter applied to all API routes.
 * Default: 100 requests per 15 minutes per IP.
 */
export const globalRateLimiter = rateLimit({
  windowMs: globalWindowMs,
  max: globalMaxRequests,
  standardHeaders: 'draft-7', // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: Math.ceil(globalWindowMs / 1000),
  },
  statusCode: 429,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/api/health',
});

/**
 * Stricter rate limiter for sensitive endpoints.
 * Default: 10 requests per 1 minute per IP.
 *
 * Applied to:
 * - /api/profiles (profile management, data seeding)
 * - /api/import (file uploads, CSV processing)
 * - /api/data (data export/backup operations)
 */
export const sensitiveRateLimiter = rateLimit({
  windowMs: sensitiveWindowMs,
  max: sensitiveMaxRequests,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error:
      'Rate limit exceeded for this endpoint. Please wait before retrying.',
    retryAfter: Math.ceil(sensitiveWindowMs / 1000),
  },
  statusCode: 429,
});
