import { useQuery as useEvoluQuery } from "@evolu/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPublicClient, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { useEvolu } from "~/lib/evolu";
import {
	createEnsCacheQuery,
	isNameCacheStale,
	upsertEnsCache,
} from "~/lib/queries/cache";

// Public RPC endpoint for ENS resolution
const ENS_RPC_URL = "https://eth.llamarpc.com";

let ensClient: ReturnType<typeof createPublicClient> | null = null;

function getEnsClient() {
	if (!ensClient) {
		ensClient = createPublicClient({
			chain: mainnet,
			transport: http(ENS_RPC_URL),
		});
	}
	return ensClient;
}

interface UseEnsNameQueryOptions {
	address: string;
	enabled?: boolean;
}

/**
 * Reverse lookup: address → ENS name
 * Returns the primary ENS (.eth) name for an address
 * Uses 8-hour cache with stale-while-revalidate
 */
export const useEnsNameQuery = ({
	address,
	enabled = true,
}: UseEnsNameQueryOptions) => {
	const evolu = useEvolu();
	const queryClient = useQueryClient();

	// Get cached ENS name from Evolu
	const cachedRows = useEvoluQuery(createEnsCacheQuery(evolu, address));
	const cached = cachedRows[0];
	const updatedAtStr =
		cached && typeof cached.updatedAt === "string" ? cached.updatedAt : null;
	const isStale = cached ? isNameCacheStale(updatedAtStr) : true;

	// Main query: fetches fresh data (only if no cache or stale)
	const freshQuery = useQuery({
		queryKey: ["ens", address],
		queryFn: async () => {
			const client = getEnsClient();
			const ensName = await client.getEnsName({
				address: address as `0x${string}`,
			});

			// Cache the result
			await upsertEnsCache(evolu, {
				address,
				ensName,
			});

			return {
				ok: true,
				address,
				ensName,
				timestamp: Date.now(),
			} as const;
		},
		enabled:
			enabled &&
			Boolean(address) &&
			isAddress(address as `0x${string}`) &&
			isStale,
		staleTime: 1000 * 60 * 60 * 24, // 24 hours - trust our cache more
		gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in memory for 7 days
		retry: 1,
	});

	// Background refresh: if cache is stale, start a refresh but don't block on it
	useQuery({
		queryKey: ["ens", "refresh", address],
		queryFn: async () => {
			const client = getEnsClient();
			const ensName = await client.getEnsName({
				address: address as `0x${string}`,
			});

			// Update cache in background
			await upsertEnsCache(evolu, {
				address,
				ensName,
			});

			// Invalidate main query to trigger re-render with fresh data
			queryClient.invalidateQueries({ queryKey: ["ens", address] });

			return {
				ok: true,
				address,
				ensName,
				timestamp: Date.now(),
			} as const;
		},
		enabled:
			enabled &&
			Boolean(address) &&
			isAddress(address as `0x${string}`) &&
			cached &&
			!isStale,
		staleTime: 1000 * 60 * 60 * 24, // 24 hours
		retry: 1,
	});

	// If cache is fresh, return it as a query-like object
	if (cached && !isStale && updatedAtStr) {
		const ensName =
			cached.ensName && typeof cached.ensName === "string"
				? cached.ensName
				: null;
		return {
			data: {
				ok: true,
				address,
				ensName,
				timestamp: new Date(updatedAtStr).getTime(),
			} as const,
			isLoading: false,
			isError: false,
		} as const;
	}

	// Otherwise return the fresh query
	return freshQuery;
};
