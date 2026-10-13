/**
 * In-Memory Sliding Window Rate Limiter
 * Configured default: 100 requests/users per second per identifier (IP or User ID)
 */

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

// Global in-memory storage for rate limits
const storage = new Map<string, RateLimitRecord>();

// Clean up stale entries every 60 seconds to prevent memory leaks
let lastCleanup = Date.now();
function cleanupStorage(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < 60000) return;
  lastCleanup = now;

  for (const [key, record] of storage.entries()) {
    const valid = record.timestamps.filter((ts) => now - ts < windowMs);
    if (valid.length === 0) {
      storage.delete(key);
    } else {
      record.timestamps = valid;
    }
  }
}

/**
 * Check if a given key has exceeded the rate limit.
 *
 * @param key Unique identifier (e.g., client IP address or user ID)
 * @param limit Maximum allowed requests in the time window (default: 100)
 * @param windowMs Time window in milliseconds (default: 1000ms = 1 second)
 */
export function checkRateLimit(
  key: string,
  limit: number = Number(process.env.RATE_LIMIT_PER_SEC) || 100,
  windowMs: number = 1000
): RateLimitResult {
  const now = Date.now();
  cleanupStorage(windowMs);

  let record = storage.get(key);
  if (!record) {
    record = { timestamps: [] };
    storage.set(key, record);
  }

  // Filter out timestamps outside the active sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  const currentCount = record.timestamps.length;

  if (currentCount >= limit) {
    const oldest = record.timestamps[0] || now;
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return {
      success: false,
      limit,
      remaining: 0,
      resetMs,
    };
  }

  // Record this request
  record.timestamps.push(now);

  const oldest = record.timestamps[0] || now;
  const resetMs = Math.max(0, windowMs - (now - oldest));

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - record.timestamps.length),
    resetMs,
  };
}

/**
 * Reset rate limit storage (useful for unit tests)
 */
export function resetRateLimits() {
  storage.clear();
}
