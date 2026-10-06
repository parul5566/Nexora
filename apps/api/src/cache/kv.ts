import 'dotenv/config';
import { Redis } from 'ioredis';

/**
 * KV cache interface (provider-swap pattern per directive).
 * Uses Redis when REDIS_URL is configured; falls back to an
 * in-process Map so the platform never hard-fails without Redis.
 */
export interface KvCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

class MemoryCache implements KvCache {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  async get(key: string) {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt && e.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }
  async del(key: string) {
    this.store.delete(key);
  }
}

class RedisCache implements KvCache {
  constructor(private client: Redis) {}
  async get(key: string) {
    return this.client.get(key);
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
    else await this.client.set(key, value);
  }
  async del(key: string) {
    await this.client.del(key);
  }
}

let cache: KvCache | null = null;

export async function getCache(): Promise<KvCache> {
  if (cache) return cache;
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const client = new Redis(url);
      cache = new RedisCache(client);
      console.log('cache: redis');
      return cache;
    } catch (err) {
      console.warn('cache: redis unavailable, using memory fallback', err);
    }
  }
  cache = new MemoryCache();
  console.log('cache: memory fallback');
  return cache;
}

export async function checkRedis(): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) return false;
  try {
    const c = await getCache();
    await c.set('health:ping', '1', 5);
    return (await c.get('health:ping')) === '1';
  } catch {
    return false;
  }
}
