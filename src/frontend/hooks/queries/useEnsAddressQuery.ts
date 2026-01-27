import { useQuery as useEvoluQuery } from "@evolu/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { useEvolu } from "~/lib/evolu";
import {
	createEnsAddressCacheQuery,
	isNameCacheStale,
	upsertEnsAddressCache,
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

interface UseEnsAddressQueryOptions {
	name: string;
	enabled?: boolean;
}

/**
 * Forward lookup: ENS name → address on Ethereum mainnet
 * Resolves a .eth name to its address
 * Uses 8-hour cache with stale-while-revalidate
 */
export const useEnsAddressQuery = ({
	name,
	enabled = true,
}: UseEnsAddressQueryOptions) => {
	const evolu = useEvolu();
	const queryClient = useQueryClient();

	// Normalize name using viem's ENSIP-15 canonical normalization
	let normalizedName: string;
	try {
		normalizedName = normalize(name);
	} catch {
		// If normalization fails, fall back to lowercase for basic validation
		normalizedName = name.toLowerCase();
	}

	// Get cached address from Evolu
	const cachedRows = useEvoluQuery(
		createEnsAddressCacheQuery(evolu, normalizedName),
	);
	const cached = cachedRows[0];
	const updatedAtStr =
		cached && typeof cached.updatedAt === "string" ? cached.updatedAt : null;
	const isStale = cached ? isNameCacheStale(updatedAtStr) : true;

	// Main query: fetches fresh data (only if no cache or stale)
	const freshQuery = useQuery({
		queryKey: ["ensAddress", normalizedName],
		queryFn: async () => {
			// Validate ENS name format (using normalized name for case-insensitive check)
			if (
				!normalizedName.endsWith(".eth") ||
				normalizedName.length < 5 ||
				normalizedName.length > 50
			) {
				return {
					ok: false,
					error:
						"Invalid ENS name format. Must end with .eth and be 5-50 characters.",
					code: "INVALID_NAME",
				} as const;
			}

			const client = getEnsClient();

			// Forward lookup: get address from ENS name
			const address = await client.getEnsAddress({
				name: normalizedName,
			});

			// Cache the result (even null results are cached)
			await upsertEnsAddressCache(evolu, {
				name: normalizedName,
				address,
			});

			// If address is null, the name exists but has no resolver or no address set
			if (!address) {
				return {
					ok: false,
					error: `ENS name "${normalizedName}" does not resolve to an address.`,
					code: "NAME_NOT_FOUND",
				} as const;
			}

			return {
				ok: true,
				name: normalizedName,
				address,
				timestamp: Date.now(),
			} as const;
		},
		// Only enable query if name looks like ENS (basic format check)
		enabled:
			enabled && Boolean(name) && normalizedName.endsWith(".eth") && isStale,
		staleTime: 1000 * 60 * 60 * 24, // 24 hours - trust our cache more
		gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in memory for 7 days
		retry: 1,
	});

	// Background refresh: if cache is stale, start a refresh but don't block on it
	useQuery({
		queryKey: ["ensAddress", "refresh", normalizedName],
		queryFn: async () => {
			const client = getEnsClient();

			const address = await client.getEnsAddress({
				name: normalizedName,
			});

			// Update cache in background
			await upsertEnsAddressCache(evolu, {
				name: normalizedName,
				address,
			});

			// Invalidate main query to trigger re-render with fresh data
			queryClient.invalidateQueries({
				queryKey: ["ensAddress", normalizedName],
			});

			// Return the result (error handling for background refresh)
			if (!address) {
				return {
					ok: false,
					error: `ENS name "${normalizedName}" does not resolve to an address.`,
					code: "NAME_NOT_FOUND",
				} as const;
			}

			return {
				ok: true,
				name: normalizedName,
				address,
				timestamp: Date.now(),
			} as const;
		},
		enabled:
			enabled &&
			Boolean(name) &&
			normalizedName.endsWith(".eth") &&
			cached &&
			!isStale,
		staleTime: 1000 * 60 * 60 * 24, // 24 hours
		retry: 1,
	});

	// Return cached data as query-like object if fresh
	if (cached && !isStale && updatedAtStr) {
		const address =
			cached.address && typeof cached.address === "string"
				? cached.address
				: null;
		if (!address) {
			return {
				data: {
					ok: false,
					error: `ENS name "${normalizedName}" does not resolve to an address.`,
					code: "NAME_NOT_FOUND",
				} as const,
				isLoading: false,
			} as const;
		}

		return {
			data: {
				ok: true,
				name: normalizedName,
				address,
				timestamp: new Date(updatedAtStr).getTime(),
			} as const,
			isLoading: false,
		} as const;
	}

	// Otherwise return the fresh query
	return freshQuery;
};
