import { useQuery as useEvoluQuery } from "@evolu/react";
import type { ApiResponses } from "@shared/api";
import { apiEndpoints, buildUrl } from "@shared/api";
import type { TokenMetadataMap } from "@shared/types";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";
import { useEffect, useMemo } from "react";
import { useEvolu } from "~/lib/evolu";
import {
	createAllTokenMetadataCacheQuery,
	isCacheStale,
	upsertTokenMetadataCache,
} from "~/lib/queries/cache";

const api = fetcher({ base: `${window.location.origin}/api` });

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

interface UsePersistedTokenMetadataQueryOptions {
	readonly coinIds: readonly string[];
	readonly enabled?: boolean;
}

/**
 * Persisted token metadata query with stale-while-revalidate pattern.
 *
 * On mount:
 * 1. Immediately returns cached metadata from Evolu (if available)
 * 2. Fetches fresh metadata from API in background
 * 3. Updates Evolu cache on success
 * 4. Returns staleness indicator based on cache age
 */
export const usePersistedTokenMetadataQuery = ({
	coinIds,
	enabled = true,
}: UsePersistedTokenMetadataQueryOptions) => {
	const evolu = useEvolu();

	// 1. Get all cached metadata from Evolu (single query)
	const cacheQuery = useMemo(
		() => createAllTokenMetadataCacheQuery(evolu),
		[evolu],
	);
	const cachedRows = useEvoluQuery(cacheQuery);

	// Transform cached rows into TokenMetadataMap format
	const cachedMetadata = useMemo(() => {
		// Create a map of coinId -> row for quick lookup
		const cacheMap = new Map<string, (typeof cachedRows)[0]>();
		for (const row of cachedRows) {
			const coinId =
				row.coinId && typeof row.coinId === "string" ? row.coinId : null;
			if (coinId) {
				cacheMap.set(coinId, row);
			}
		}

		const metadata: TokenMetadataMap = {};
		let oldestUpdatedAt: string | null = null;

		// Only include coinIds that were requested
		for (const coinId of coinIds) {
			const row = cacheMap.get(coinId);
			if (row) {
				const rowCoinId =
					row.coinId && typeof row.coinId === "string" ? row.coinId : null;
				const rowName =
					row.name && typeof row.name === "string" ? row.name : null;
				const rowSymbol =
					row.symbol && typeof row.symbol === "string" ? row.symbol : null;
				const rowThumb =
					row.imageThumb && typeof row.imageThumb === "string"
						? row.imageThumb
						: null;
				const rowSmall =
					row.imageSmall && typeof row.imageSmall === "string"
						? row.imageSmall
						: null;
				const rowLarge =
					row.imageLarge && typeof row.imageLarge === "string"
						? row.imageLarge
						: null;

				if (
					rowCoinId &&
					rowName &&
					rowSymbol &&
					rowThumb &&
					rowSmall &&
					rowLarge
				) {
					metadata[coinId] = {
						id: rowCoinId,
						name: rowName,
						symbol: rowSymbol,
						image: {
							thumb: rowThumb,
							small: rowSmall,
							large: rowLarge,
						},
					};
					// Track oldest update time for staleness calculation
					const updatedAtStr =
						row.updatedAt && typeof row.updatedAt === "string"
							? row.updatedAt
							: null;
					if (
						updatedAtStr &&
						(!oldestUpdatedAt || updatedAtStr < oldestUpdatedAt)
					) {
						oldestUpdatedAt = updatedAtStr;
					}
				}
			}
		}

		if (Object.keys(metadata).length === 0) return null;

		return { tokens: metadata, updatedAt: oldestUpdatedAt };
	}, [cachedRows, coinIds]);

	// 2. Fetch fresh metadata from API
	const ids = coinIds.join(",");
	const apiQuery = useTanstackQuery({
		queryKey: ["tokenMetadata", ids],
		queryFn: async () => {
			const url = buildUrl(apiEndpoints.tokensMetadata.path, {
				query: { ids },
			});
			return api.get<ApiResponses["tokensMetadata"]>(url);
		},
		enabled: enabled && coinIds.length > 0,
		staleTime: ONE_DAY_MS,
	});

	// 3. Update Evolu cache when fresh data arrives
	useEffect(() => {
		if (apiQuery.data?.ok && apiQuery.data.tokens) {
			// Fire-and-forget with error handling
			Object.entries(apiQuery.data.tokens).forEach(([, token]) => {
				upsertTokenMetadataCache(evolu, {
					coinId: token.id,
					name: token.name,
					symbol: token.symbol,
					imageThumb: token.image.thumb,
					imageSmall: token.image.small,
					imageLarge: token.image.large,
				}).catch((err) => {
					console.warn("Failed to cache token metadata:", err);
				});
			});
		}
	}, [evolu, apiQuery.data]);

	// 4. Compute staleness (24 hours for token metadata)
	const isStale = isCacheStale(cachedMetadata?.updatedAt, ONE_DAY_MS);

	// Return combined state
	return {
		// Fresh API data if available
		data: apiQuery.data,
		// Cached metadata for immediate display
		cached: cachedMetadata,
		// Loading states
		isLoading: apiQuery.isLoading && !cachedMetadata,
		isFetching: apiQuery.isFetching,
		isStale,
		// Has any data (cached or fresh)
		hasData: Boolean(apiQuery.data?.ok || cachedMetadata),
		// Error from API
		error: apiQuery.error,
	};
};
