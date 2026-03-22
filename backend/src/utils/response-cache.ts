type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

const cacheMetrics = {
  hits: 0,
  misses: 0
};

const logMetrics = () => {
  if (process.env.NODE_ENV === "production") return;
  // eslint-disable-next-line no-console
  console.log(`[cache] hits=${cacheMetrics.hits} misses=${cacheMetrics.misses} size=${cacheStore.size}`);
};

export const buildCacheKey = (...parts: Array<string | number | undefined>) =>
  parts
    .filter((part) => part !== undefined && part !== "")
    .map((part) => String(part))
    .join("::");

export const getOrSetCache = async <T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const existing = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    cacheMetrics.hits += 1;
    logMetrics();
    return existing.value;
  }

  if (existing && existing.expiresAt <= now) {
    cacheStore.delete(key);
  }

  cacheMetrics.misses += 1;
  const value = await loader();
  cacheStore.set(key, { value, expiresAt: now + ttlMs });
  logMetrics();
  return value;
};

export const invalidateCacheByPrefix = (prefix: string) => {
  for (const key of Array.from(cacheStore.keys())) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
};
