import { useQuery } from "@evolu/react";
import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";
import { useEffect, useMemo } from "react";
import { useEvolu } from "~/lib/evolu";
import {
	createAllPricesCacheQuery,
	isCacheStale,
	upsertPricesCache,
} from "~/lib/queries/cache";

const api = fetcher({ base: `${window.location.origin}/api` });

export const DEFAULT_COIN_IDS = [
	"ethereum",
	"tron",
	"usd-coin",
	"tether",
] as const;

const FIVE_MINUTES_MS = 1000 * 60 * 5;

interface UsePersistedPricesQueryOptions {
	readonly coinIds?: readonly string[];
	readonly enabled?: boolean;
}

/**
 * Persisted prices query with stale-while-revalidate pattern.
 *
 * On mount:
 * 1. Immediately returns cached prices from Evolu (if available)
 * 2. Fetches fresh prices from API in background
 * 3. Updates Evolu cache on success
 * 4. Returns staleness indicator based on cache age
 */
export const usePersistedPricesQuery = ({
	coinIds = DEFAULT_COIN_IDS,
	enabled = true,
}: UsePersistedPricesQueryOptions) => {
	const evolu = useEvolu();

	// 1. Get all cached prices from Evolu
	const cacheQuery = useMemo(() => createAllPricesCacheQuery(evolu), [evolu]);
	const cachedRows = useQuery(cacheQuery);

	// Transform cached rows into the expected format
	const cachedPrices = useMemo(() => {
		if (cachedRows.length === 0) return null;

		const prices: Record<string, { usd: number }> = {};
		let oldestUpdatedAt: string | null = null;

		for (const row of cachedRows) {
			const coinId =
				row.coinId && typeof row.coinId === "string" ? row.coinId : null;
			const priceUsd = typeof row.priceUsd === "number" ? row.priceUsd : null;
			const updatedAt =
				row.updatedAt && typeof row.updatedAt === "string"
					? row.updatedAt
					: null;

			if (coinId && priceUsd !== null) {
				// Narrowed interface ensures priceUsd is non-null
				interface NarrowedPriceCacheRow {
					coinId: string;
					priceUsd: number;
					updatedAt: string | null;
				}
				const narrowed: NarrowedPriceCacheRow = {
					coinId,
					priceUsd,
					updatedAt,
				};
				prices[narrowed.coinId] = { usd: narrowed.priceUsd };
				// Track oldest update time for staleness calculation
				if (
					narrowed.updatedAt &&
					(!oldestUpdatedAt || narrowed.updatedAt < oldestUpdatedAt)
				) {
					oldestUpdatedAt = narrowed.updatedAt;
				}
			}
		}

		return { prices, updatedAt: oldestUpdatedAt };
	}, [cachedRows]);

	// 2. Fetch fresh prices from API
	const apiQuery = useTanstackQuery({
		queryKey: ["prices", coinIds.join(",")],
		queryFn: async () => {
			const ids = coinIds.join(",");
			const url = buildUrl(apiEndpoints.prices.path, {
				query: { ids },
			});
			return api.get<ApiResponses["prices"]>(url);
		},
		enabled: enabled && coinIds.length > 0,
		staleTime: FIVE_MINUTES_MS,
		refetchInterval: FIVE_MINUTES_MS,
	});

	// 3. Update Evolu cache when fresh data arrives
	useEffect(() => {
		if (apiQuery.data?.ok && apiQuery.data.prices) {
			upsertPricesCache(evolu, apiQuery.data.prices).catch((err) => {
				console.warn("Failed to cache prices:", err);
			});
		}
	}, [evolu, apiQuery.data]);

	// 4. Compute staleness
	const isStale = isCacheStale(cachedPrices?.updatedAt);

	// Return combined state
	return {
		// Fresh API data if available
		data: apiQuery.data,
		// Cached prices for immediate display
		cached: cachedPrices,
		// Loading states
		isLoading: apiQuery.isLoading && !cachedPrices,
		isFetching: apiQuery.isFetching,
		isStale,
		// Has any data (cached or fresh)
		hasData: Boolean(apiQuery.data?.ok || cachedPrices),
		// Error from API
		error: apiQuery.error,
	};
};
