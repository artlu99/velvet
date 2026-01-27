import type { Context } from "hono";

/**
 * Cache status type
 */
export type CacheStatus = "hit" | "miss" | "bypass";

/**
 * Result from getCached function
 */
export interface GetCachedResult<T> {
	cached: T | null;
	status: CacheStatus;
}

/**
 * Options for the withCache helper
 */
export interface WithCacheOptions<T> {
	cacheKey: string;
	cacheBust: string | undefined;
	headerName: string;
	ttl: number;
	fetcher: () => Promise<T>;
}

/**
 * Gets a cached value from the KV store
 * @param cache - The KV namespace
 * @param cacheKey - The cache key
 * @param bypassCache - Whether to bypass the cache
 * @returns The cached value (or null) along with the cache status
 */
export async function getCached<T>(
	cache: KVNamespace,
	cacheKey: string,
	bypassCache: boolean,
): Promise<GetCachedResult<T>> {
	if (bypassCache) {
		return { cached: null, status: "bypass" };
	}

	const cached = await cache.get(cacheKey, "json");
	if (cached) {
		return { cached: cached as T, status: "hit" };
	}

	return { cached: null, status: "miss" };
}

/**
 * Sets a value in the KV cache with TTL
 * @param cache - The KV namespace
 * @param cacheKey - The cache key
 * @param result - The result to cache (must be JSON-serializable)
 * @param ttl - Time to live in seconds
 */
export async function setCached(
	cache: KVNamespace,
	cacheKey: string,
	result: unknown,
	ttl: number,
): Promise<void> {
	await cache.put(cacheKey, JSON.stringify(result), {
		expirationTtl: ttl,
	});
}

/**
 * Sets the cache header on the response
 * @param c - The Hono context
 * @param headerName - The name of the header to set
 * @param status - The cache status
 */
export function setCacheHeader(
	c: Context,
	headerName: string,
	status: CacheStatus,
): void {
	c.header(headerName, status);
}

/**
 * Higher-order helper for cached endpoints
 * Handles cache retrieval, setting, and header management
 * @param c - The Hono context
 * @param options - Cache and fetcher options
 * @returns The cached or freshly fetched result
 *
 * NOTE: Uses BALANCE_CACHE KV namespace for all cached data (balances, prices, ENS)
 * despite the name - cache keys are namespaced (e.g., "balance:...", "prices:...")
 */
export async function withCache<T, E extends Cloudflare.Env = Cloudflare.Env>(
	c: Context<{ Bindings: E }>,
	options: WithCacheOptions<T>,
): Promise<T> {
	const { cached, status } = await getCached<T>(
		c.env.BALANCE_CACHE,
		options.cacheKey,
		options.cacheBust !== undefined,
	);

	// Set cache header to indicate status
	setCacheHeader(c, options.headerName, status);

	// Return cached value if available
	if (cached !== null && status !== "bypass") {
		return cached;
	}

	// Fetch fresh data
	const result = await options.fetcher();

	// Cache the result if not bypassing
	if (status !== "bypass") {
		await setCached(c.env.BALANCE_CACHE, options.cacheKey, result, options.ttl);
	}

	return result;
}
