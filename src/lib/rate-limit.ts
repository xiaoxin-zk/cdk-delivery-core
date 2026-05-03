import Redis from "ioredis";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";

type Bucket = {
  count: number;
  expiresAt: number;
};

const memoryBuckets = new Map<string, Bucket>();
let lastPurge = Date.now();
let redis: Redis | null | undefined;

function getRedis() {
  if (!env.redisUrl) return null;
  if (redis === undefined) {
    redis = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true
    });
    redis.on("error", () => undefined);
  }
  return redis;
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const redisClient = getRedis();
  if (redisClient) {
    try {
      const current = await redisClient.incr(key);
      if (current === 1) await redisClient.expire(key, windowSeconds);
      if (current > limit) throw new ApiError("操作过于频繁，请稍后再试", 429, "RATE_LIMITED");
      return;
    } catch (error) {
      if (error instanceof ApiError) throw error;
    }
  }

  const now = Date.now();

  if (now - lastPurge > 60_000) {
    lastPurge = now;
    for (const [k, v] of memoryBuckets) {
      if (v.expiresAt <= now) memoryBuckets.delete(k);
    }
  }

  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    memoryBuckets.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError("操作过于频繁，请稍后再试", 429, "RATE_LIMITED");
  }
}
