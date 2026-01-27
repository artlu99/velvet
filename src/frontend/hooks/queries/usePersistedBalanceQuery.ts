import { useQuery } from "@evolu/react";
import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import type { SupportedChainId } from "@shared/types";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";
import { useEffect, useMemo } from "react";
import { useEvolu } from "~/lib/evolu";
import {
	createBalanceCacheQuery,
	isCacheStale,
	upsertBalanceCache,
} from "~/lib/queries/cache";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UsePersistedBalanceQueryOptions {
	address: string;
	chainId: SupportedChainId;
	enabled?: boolean;
	cacheBust?: boolean;
}

/**
 * Persisted balance query with stale-while-revalidate pattern.
 *
 * On mount:
 * 1. Immediately returns cached balance from Evolu (if available)
 * 2. Fetches fresh balance from API in background
 * 3. Updates Evolu cache on success
 * 4. Returns staleness indicator based on cache age
 */
export const usePersistedBalanceQuery = ({
	address,
	chainId,
	enabled = true,
	cacheBust = false,
}: UsePersistedBalanceQueryOptions) => {
	const evolu = useEvolu();
	const chainIdStr = String(chainId);

	// 1. Get cached balance from Evolu
	const cacheQuery = useMemo(
		() => createBalanceCacheQuery(evolu, address, chainIdStr),
		[evolu, address, chainIdStr],
	);
	const cachedRows = useQuery(cacheQuery);
	const cached = cachedRows[0] as
		| {
				balanceRaw: string;
				updatedAt: string | null;
		  }
		| undefined;

	// 2. Fetch fresh balance from API
	const apiQuery = useTanstackQuery({
		queryKey: ["balance", address, chainId, cacheBust],
		queryFn: async () => {
			const query: Record<string, string> = { chainId: chainIdStr };
			if (cacheBust) {
				query.cacheBust = "1";
			}
			const url = buildUrl(apiEndpoints.balance.path, {
				address,
				query,
			});
			return api.get<ApiResponses["balance"]>(url);
		},
		enabled: enabled && Boolean(address),
		staleTime: 1000 * 60 * 5, // 5 minutes
	});

	// 3. Update Evolu cache when fresh data arrives
	useEffect(() => {
		if (apiQuery.data?.ok) {
			// Fire-and-forget with error handling
			upsertBalanceCache(evolu, {
				address,
				chainId: chainIdStr,
				balanceRaw: apiQuery.data.balanceWei,
			}).catch((err) => {
				console.warn("Failed to cache balance:", err);
			});
		}
	}, [evolu, address, chainIdStr, apiQuery.data]);

	// 4. Compute staleness
	const isStale = isCacheStale(cached?.updatedAt);

	// Return combined state
	return {
		// Fresh API data if available, otherwise cached data
		data: apiQuery.data,
		// Cached data for immediate display
		cached: cached
			? {
					balanceRaw: cached.balanceRaw,
					updatedAt: cached.updatedAt,
				}
			: null,
		// Loading states
		isLoading: apiQuery.isLoading && !cached,
		isFetching: apiQuery.isFetching,
		isStale,
		// Has any data (cached or fresh)
		hasData: Boolean(apiQuery.data?.ok || cached?.balanceRaw),
		// Error from API
		error: apiQuery.error,
	};
};
