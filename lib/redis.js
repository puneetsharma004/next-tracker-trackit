import { Redis } from '@upstash/redis'

/**
 * Upstash Redis client instance.
 * Automatically configured via UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 * Only use this in API routes and Server Components.
 */
export const redis = Redis.fromEnv()
