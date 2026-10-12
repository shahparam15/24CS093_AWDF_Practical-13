import NodeCache from "node-cache";

// Requirement 1: Shared NodeCache instance with default TTL of 60 seconds
const DEFAULT_TTL_SECONDS = 60;

export const taskCache = new NodeCache({
  stdTTL: DEFAULT_TTL_SECONDS,
  checkperiod: 120, // Period in seconds for automatic delete checks
  useClones: false, // Performance optimization: disable deep cloning of cache objects
});

// Cache statistics counters
const stats = {
  hits: 0,
  misses: 0,
};

/**
 * Generate stable user-scoped cache key for task lists
 * Prevents cross-user or cross-tenant data leakage
 */
export function getTasksCacheKey(userId, query = {}) {
  const parts = [
    `completed=${query.completed !== undefined ? query.completed : "all"}`,
    `priority=${query.priority || "all"}`,
    `search=${query.search ? encodeURIComponent(query.search.trim()) : ""}`,
    `sort=${query.sort || "newest"}`,
  ];
  return `tasks:${userId}:${parts.join("&")}`;
}

/**
 * Generate stable user-scoped cache key for individual tasks
 */
export function getSingleTaskCacheKey(userId, taskId) {
  return `task:${userId}:${taskId}`;
}

/**
 * Fetch from cache with automatic hit/miss statistics tracking
 */
export function getFromCache(key) {
  const data = taskCache.get(key);
  if (data !== undefined) {
    stats.hits += 1;
    return { hit: true, data };
  }
  stats.misses += 1;
  return { hit: false, data: null };
}

/**
 * Store in cache with specified or default TTL
 */
export function setToCache(key, value, ttl = DEFAULT_TTL_SECONDS) {
  return taskCache.set(key, value, ttl);
}

/**
 * Invalidate a single key
 */
export function invalidateKey(key) {
  return taskCache.del(key);
}

/**
 * Requirement 3: Invalidate all-tasks cache entries for a specific user
 * Scans all keys starting with `tasks:${userId}:` and deletes them
 */
export function invalidateUserTasks(userId) {
  const prefix = `tasks:${userId}:`;
  const keys = taskCache.keys();
  const matchingKeys = keys.filter((k) => k.startsWith(prefix));
  if (matchingKeys.length > 0) {
    taskCache.del(matchingKeys);
  }
  return matchingKeys.length;
}

/**
 * Invalidate both all-tasks cache and the single-task cache for an updated or deleted task
 */
export function invalidateUserTaskAndList(userId, taskId) {
  invalidateUserTasks(userId);
  if (taskId) {
    invalidateKey(getSingleTaskCacheKey(userId, taskId));
  }
}

/**
 * Requirement 5: Return cache statistics without leaking sensitive task data or secrets
 */
export function getCacheStatistics() {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? parseFloat(((stats.hits / total) * 100).toFixed(2)) : 0;
  const nodeCacheStats = taskCache.getStats();

  return {
    hits: stats.hits,
    misses: stats.misses,
    totalRequests: total,
    hitRatePercentage: hitRate,
    keysCount: taskCache.getStats().keys,
    defaultTTLSeconds: DEFAULT_TTL_SECONDS,
    internalNodeCacheStats: nodeCacheStats,
  };
}

/**
 * Reset statistics counters (useful for isolated performance runs and tests)
 */
export function resetCacheStatistics() {
  stats.hits = 0;
  stats.misses = 0;
}

/**
 * Clear all cache entries and reset stats
 */
export function clearAllCache() {
  taskCache.flushAll();
  resetCacheStatistics();
}

export default taskCache;
