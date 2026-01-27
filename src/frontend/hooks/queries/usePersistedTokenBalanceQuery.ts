import { useQuery } from "@evolu/react";
import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import type { SupportedChainId } from "@shared/types";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";
import { useEffect, useMemo } from "react";
import { useEvolu } from "~/lib/evolu";
import {
	createBalanceCacheQuery,
	createTokenBalanceCacheQuery,
	isCacheStale,
	upsertBalanceCache,
	upsertTokenBalanceCache,
} from "~/lib/queries/cache";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UsePersistedErc20BalanceQueryOptions {
	address: string;
	contract: string;
	chainId: SupportedChainId;
	enabled?: boolean;
	cacheBust?: boolean;
}

/**
 * Persisted ERC20 balance query with stale-while-revalidate pattern.
 */
export const usePersistedErc20BalanceQuery = ({
	address,
	contract,
	chainId,
	enabled = true,
	cacheBust = false,
}: UsePersistedErc20BalanceQueryOptions) => {
	const evolu = useEvolu();
	const chainIdStr = String(chainId);

	// 1. Get cached balance from Evolu
	const cacheQuery = useMemo(
		() => createTokenBalanceCacheQuery(evolu, address, contract, chainIdStr),
		[evolu, address, contract, chainIdStr],
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
		queryKey: ["erc20Balance", address, contract, chainId],
		queryFn: async () => {
			const query: Record<string, string> = { chainId: chainIdStr };
			if (cacheBust) {
				query.cacheBust = "1";
			}
			const url = buildUrl(apiEndpoints.erc20Balance.path, {
				address,
				contract,
				query,
			});
			return api.get<ApiResponses["erc20Balance"]>(url);
		},
		enabled: enabled && Boolean(address) && Boolean(contract),
		staleTime: 1000 * 60 * 5,
	});

	// 3. Update Evolu cache when fresh data arrives
	useEffect(() => {
		if (apiQuery.data?.ok) {
			upsertTokenBalanceCache(evolu, {
				address,
				tokenAddress: contract,
				chainId: chainIdStr,
				balanceRaw: apiQuery.data.balanceRaw,
			}).catch((err) => {
				console.warn("Failed to cache ERC20 balance:", err);
			});
		}
	}, [evolu, address, contract, chainIdStr, apiQuery.data]);

	const isStale = isCacheStale(cached?.updatedAt);

	return {
		data: apiQuery.data,
		cached: cached
			? {
					balanceRaw: cached.balanceRaw,
					updatedAt: cached.updatedAt,
				}
			: null,
		isLoading: apiQuery.isLoading && !cached,
		isFetching: apiQuery.isFetching,
		isStale,
		hasData: Boolean(apiQuery.data?.ok || cached?.balanceRaw),
		error: apiQuery.error,
	};
};

interface UsePersistedTrc20BalanceQueryOptions {
	address: string;
	contract: string;
	enabled?: boolean;
	cacheBust?: boolean;
}

/**
 * Persisted TRC20 balance query with stale-while-revalidate pattern.
 */
export const usePersistedTrc20BalanceQuery = ({
	address,
	contract,
	enabled = true,
	cacheBust = false,
}: UsePersistedTrc20BalanceQueryOptions) => {
	const evolu = useEvolu();
	const chainIdStr = "tron";

	// 1. Get cached balance from Evolu
	const cacheQuery = useMemo(
		() => createTokenBalanceCacheQuery(evolu, address, contract, chainIdStr),
		[evolu, address, contract],
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
		queryKey: ["trc20Balance", address, contract, cacheBust],
		queryFn: async () => {
			const query: Record<string, string> = {};
			if (cacheBust) {
				query.cacheBust = "1";
			}
			const url = buildUrl(apiEndpoints.trc20Balance.path, {
				address,
				contract,
				query,
			});
			return api.get<ApiResponses["trc20Balance"]>(url);
		},
		enabled: enabled && Boolean(address) && Boolean(contract),
		staleTime: 1000 * 60 * 5,
	});

	// 3. Update Evolu cache when fresh data arrives
	// TRC20 returns balanceFormatted, store as balanceRaw for consistency
	useEffect(() => {
		if (apiQuery.data?.ok) {
			upsertTokenBalanceCache(evolu, {
				address,
				tokenAddress: contract,
				chainId: chainIdStr,
				balanceRaw: apiQuery.data.balanceFormatted,
			}).catch((err) => {
				console.warn("Failed to cache TRC20 balance:", err);
			});
		}
	}, [evolu, address, contract, apiQuery.data]);

	const isStale = isCacheStale(cached?.updatedAt);

	return {
		data: apiQuery.data,
		cached: cached
			? {
					balanceRaw: cached.balanceRaw,
					updatedAt: cached.updatedAt,
				}
			: null,
		isLoading: apiQuery.isLoading && !cached,
		isFetching: apiQuery.isFetching,
		isStale,
		hasData: Boolean(apiQuery.data?.ok || cached?.balanceRaw),
		error: apiQuery.error,
	};
};

interface UsePersistedTronBalanceQueryOptions {
	address: string;
	enabled?: boolean;
	cacheBust?: boolean;
}

/**
 * Persisted Tron native balance query with stale-while-revalidate pattern.
 */
export const usePersistedTronBalanceQuery = ({
	address,
	enabled = true,
	cacheBust = false,
}: UsePersistedTronBalanceQueryOptions) => {
	const evolu = useEvolu();
	const chainIdStr = "tron";

	// 1. Get cached balance from Evolu
	const cacheQuery = useMemo(
		() => createBalanceCacheQuery(evolu, address, chainIdStr),
		[evolu, address],
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
		queryKey: ["tronBalance", address, cacheBust],
		queryFn: async () => {
			const query: Record<string, string> = {};
			if (cacheBust) {
				query.cacheBust = "1";
			}
			const url = buildUrl(apiEndpoints.tronBalance.path, {
				address,
				query,
			});
			return api.get<ApiResponses["tronBalance"]>(url);
		},
		enabled: enabled && Boolean(address),
		staleTime: 1000 * 60 * 5,
	});

	// 3. Update Evolu cache when fresh data arrives
	useEffect(() => {
		if (apiQuery.data?.ok) {
			// Store TRX balance - API returns balanceSun (raw) and balanceTrx (formatted)
			upsertBalanceCache(evolu, {
				address,
				chainId: chainIdStr,
				balanceRaw: apiQuery.data.balanceSun,
			}).catch((err) => {
				console.warn("Failed to cache TRX balance:", err);
			});
		}
	}, [evolu, address, apiQuery.data]);

	const isStale = isCacheStale(cached?.updatedAt);

	return {
		data: apiQuery.data,
		cached: cached
			? {
					balanceRaw: cached.balanceRaw,
					updatedAt: cached.updatedAt,
				}
			: null,
		isLoading: apiQuery.isLoading && !cached,
		isFetching: apiQuery.isFetching,
		isStale,
		hasData: Boolean(apiQuery.data?.ok || cached?.balanceRaw),
		error: apiQuery.error,
	};
};
