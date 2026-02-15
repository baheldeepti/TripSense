import Redis from "ioredis";
import { log } from "./index";

let redisClient: Redis | null = null;
let redisAvailable = false;

export function getRedisClient(): Redis | null {
  return redisClient;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function initRedis(): Promise<void> {
  const host = process.env.REDIS_HOST;
  const port = parseInt(process.env.REDIS_PORT || "6379", 10);
  const password = process.env.REDIS_PASSWORD;

  if (!host || !password) {
    log("Redis credentials not configured — running without cache", "redis");
    return;
  }

  try {
    redisClient = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          log("Redis max retries reached, stopping reconnection", "redis");
          return null;
        }
        const delay = Math.min(times * 500, 3000);
        log(`Redis reconnecting in ${delay}ms (attempt ${times})`, "redis");
        return delay;
      },
      connectTimeout: 10000,
      lazyConnect: true,
    });

    redisClient.on("connect", () => {
      redisAvailable = true;
      log("Redis connected successfully", "redis");
    });

    redisClient.on("error", (err) => {
      log(`Redis error: ${err.message}`, "redis");
      redisAvailable = false;
    });

    redisClient.on("close", () => {
      redisAvailable = false;
      log("Redis connection closed", "redis");
    });

    await redisClient.connect();
    redisAvailable = true;
    log("Redis initialized and ready", "redis");
  } catch (err: any) {
    log(`Redis initialization failed: ${err.message} — running without cache`, "redis");
    redisAvailable = false;
    redisClient = null;
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  if (!redisAvailable || !redisClient) return null;
  try {
    const value = await redisClient.get(key);
    if (value) {
      log(`Cache HIT: ${key}`, "redis");
    } else {
      log(`Cache MISS: ${key}`, "redis");
    }
    return value;
  } catch (err: any) {
    log(`Cache get error for ${key}: ${err.message}`, "redis");
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number = 300): Promise<void> {
  if (!redisAvailable || !redisClient) return;
  try {
    await redisClient.set(key, value, "EX", ttlSeconds);
    log(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`, "redis");
  } catch (err: any) {
    log(`Cache set error for ${key}: ${err.message}`, "redis");
  }
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redisAvailable || !redisClient) return;
  try {
    await redisClient.del(key);
  } catch (err: any) {
    log(`Cache delete error for ${key}: ${err.message}`, "redis");
  }
}

export async function sessionGet(sessionId: string): Promise<Record<string, any> | null> {
  if (!redisAvailable || !redisClient) return null;
  try {
    const data = await redisClient.get(`session:${sessionId}`);
    if (data) {
      log(`Session HIT: ${sessionId}`, "redis");
      return JSON.parse(data);
    }
    log(`Session MISS: ${sessionId}`, "redis");
    return null;
  } catch (err: any) {
    log(`Session get error: ${err.message}`, "redis");
    return null;
  }
}

export async function sessionSet(sessionId: string, data: Record<string, any>, ttlSeconds: number = 3600): Promise<void> {
  if (!redisAvailable || !redisClient) return;
  try {
    await redisClient.set(`session:${sessionId}`, JSON.stringify(data), "EX", ttlSeconds);
    log(`Session SET: ${sessionId} (TTL: ${ttlSeconds}s)`, "redis");
  } catch (err: any) {
    log(`Session set error: ${err.message}`, "redis");
  }
}

export async function agentStateGet(agentId: string): Promise<Record<string, any> | null> {
  if (!redisAvailable || !redisClient) return null;
  try {
    const data = await redisClient.get(`agent:${agentId}`);
    if (data) {
      log(`Agent state HIT: ${agentId}`, "redis");
      return JSON.parse(data);
    }
    log(`Agent state MISS: ${agentId}`, "redis");
    return null;
  } catch (err: any) {
    log(`Agent state get error: ${err.message}`, "redis");
    return null;
  }
}

export async function agentStateSet(agentId: string, data: Record<string, any>, ttlSeconds: number = 1800): Promise<void> {
  if (!redisAvailable || !redisClient) return;
  try {
    await redisClient.set(`agent:${agentId}`, JSON.stringify(data), "EX", ttlSeconds);
    log(`Agent state SET: ${agentId} (TTL: ${ttlSeconds}s)`, "redis");
  } catch (err: any) {
    log(`Agent state set error: ${err.message}`, "redis");
  }
}
