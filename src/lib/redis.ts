import { Redis } from "@upstash/redis";
import { Job, GUARDRAILS } from "./types";

// In-memory fallback store for local development or testing without Redis credentials
class InMemoryRedisFallback {
  private store: Map<string, { value: any; expiresAt?: number }> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value as T;
  }

  async set(key: string, value: any, opts?: { ex?: number }): Promise<string> {
    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async keys(pattern: string): Promise<string[]> {
    const now = Date.now();
    const result: string[] = [];
    this.store.forEach((item, key) => {
      if (item.expiresAt && now > item.expiresAt) {
        this.store.delete(key);
        return;
      }
      if (pattern === "*" || key.startsWith(pattern.replace("*", ""))) {
        result.push(key);
      }
    });
    return result;
  }
}

// Global singleton instance for in-memory fallback during dev
const globalForMemory = globalThis as unknown as {
  inMemoryFallback?: InMemoryRedisFallback;
};

function getRedisClient(): Redis | InMemoryRedisFallback {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token && !url.includes("xxxx")) {
    return new Redis({ url, token });
  }

  if (!globalForMemory.inMemoryFallback) {
    console.warn(
      "[JobStore] Upstash Redis credentials not found; using in-memory store fallback."
    );
    globalForMemory.inMemoryFallback = new InMemoryRedisFallback();
  }
  return globalForMemory.inMemoryFallback;
}

export const jobStore = getRedisClient();

const JOB_KEY_PREFIX = "ratelimit_job:";

export async function saveJob(job: Job): Promise<void> {
  const key = `${JOB_KEY_PREFIX}${job.id}`;
  await jobStore.set(key, job, { ex: GUARDRAILS.DEFAULT_JOB_TTL_SECONDS });
}

export async function getJob(id: string): Promise<Job | null> {
  const key = `${JOB_KEY_PREFIX}${id}`;
  const job = await jobStore.get<Job>(key);
  if (!job) return null;
  return job;
}

export async function updateJob(
  id: string,
  updater: (prev: Job) => Job | Partial<Job>
): Promise<Job | null> {
  const job = await getJob(id);
  if (!job) return null;

  const updates = updater(job);
  const updatedJob: Job = { ...job, ...updates };

  await saveJob(updatedJob);
  return updatedJob;
}

export async function deleteJob(id: string): Promise<boolean> {
  const key = `${JOB_KEY_PREFIX}${id}`;
  const res = await jobStore.del(key);
  return res > 0;
}
