import { Redis } from '@upstash/redis';

// Global declaration to maintain in-memory DB during hot reloads in development
declare global {
  var _memoryDb: Map<string, any> | undefined;
}

// In-memory fallback map for local development when Upstash is not configured
const memoryDb = globalThis._memoryDb || (globalThis._memoryDb = new Map<string, any>());

const hasRedisEnv =
  typeof process !== 'undefined' &&
  !!process.env.KV_REST_API_URL &&
  !!process.env.KV_REST_API_TOKEN;

// Initialize Upstash Redis client using Vercel KV environment variable names
const redisClient = hasRedisEnv
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

/**
 * Universal Redis client wrapper.
 * Automatically falls back to an in-memory database in local development if environment variables are not found.
 */
export const redis = {
  get: async (key: string): Promise<any> => {
    if (redisClient) {
      return await redisClient.get(key);
    }
    return memoryDb.get(key) || null;
  },

  set: async (key: string, value: any, options?: { ex?: number }): Promise<any> => {
    if (redisClient) {
      if (options?.ex) {
        return await redisClient.set(key, value, { ex: options.ex });
      }
      return await redisClient.set(key, value);
    }
    
    // Fallback logic
    memoryDb.set(key, value);
    if (options?.ex) {
      // Simulate key expiration in memory
      setTimeout(() => {
        memoryDb.delete(key);
      }, options.ex * 1000);
    }
    return 'OK';
  },

  del: async (key: string): Promise<any> => {
    if (redisClient) {
      return await redisClient.del(key);
    }
    return memoryDb.delete(key) ? 1 : 0;
  },

  ping: async (): Promise<string> => {
    if (redisClient) {
      return await redisClient.ping();
    }
    return 'PONG (in-memory fallback)';
  },

  // Helper to check if Redis is using the real cloud service or in-memory fallback
  isFallback: (): boolean => {
    return !redisClient;
  }
};
