/**
 * Utility functions for refreshing React Query caches after blockchain operations.
 */

import { apiEndpoints, buildUrl } from "@shared/api";
import type { QueryClient } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";
import { normalizeAddressForQuery } from "~/lib/queries/eoa";

const api = fetcher({ base: `${window.location.origin}/api` });

/**
 * Refresh all address-related queries (balance, transaction-count) for an address.
 * Uses cacheBust=1 for balance queries to bypass KV cache.
 */
export async function refreshAddressQueries(
	queryClient: QueryClient,
	address: string,
): Promise<void> {
	const cache = queryClient.getQueryCache();
	const normalizedAddress = normalizeAddressForQuery(address);

	// Find all queries related to this address
	const addressQueries = cache.getAll().filter((q) => {
		const key = q.queryKey;
		if (key.length < 2) return false;

		// Match balance queries: ["balance", address, chainId, ...]
		if (key[0] === "balance" && typeof key[1] === "string") {
			return normalizeAddressForQuery(key[1]) === normalizedAddress;
		}

		// Match transaction-count queries: ["transaction-count", address, chainId]
		if (key[0] === "transaction-count" && typeof key[1] === "string") {
			return normalizeAddressForQuery(key[1]) === normalizedAddress;
		}

		return false;
	});

	await Promise.all(
		addressQueries.map(async (query) => {
			const [queryType, addressKey, chainId] = query.queryKey;

			if (typeof addressKey !== "string" || typeof chainId !== "number") {
				return;
			}

			if (queryType === "balance") {
				// Refresh balance with cacheBust=1 to bypass KV cache
				const url = buildUrl(apiEndpoints.balance.path, {
					address: addressKey,
					query: {
						chainId: String(chainId),
						cacheBust: "1",
					},
				});
				const freshData = await api.get(url);
				queryClient.setQueryData(query.queryKey, freshData);
			} else if (queryType === "transaction-count") {
				// Refresh transaction count (nonce) - no cacheBust needed, always fresh
				const url = buildUrl(apiEndpoints.transactionCount.path, {
					address: addressKey,
					query: {
						chainId: String(chainId),
					},
				});
				const freshData = await api.get(url);
				queryClient.setQueryData(query.queryKey, freshData);
			}
		}),
	);
}
