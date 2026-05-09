import Redis from 'ioredis';

/**
 * Redis client singleton.
 * Reuses the same instance across hot reloads in Next.js dev mode.
 * Connects to REDIS_URL from environment (default: redis://localhost:6379).
 */

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

export { redis };
