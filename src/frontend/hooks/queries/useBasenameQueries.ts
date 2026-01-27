import { useQuery as useEvoluQuery } from "@evolu/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import invariant from "tiny-invariant";
import { createPublicClient, http, isAddress } from "viem";
import { base, mainnet } from "viem/chains";
import { normalize, toCoinType } from "viem/ens";
import { useEvolu } from "~/lib/evolu";
import {
	createBasenameAddressCacheQuery,
	createBasenameCacheQuery,
	isNameCacheStale,
	upsertBasenameAddressCache,
	upsertBasenameCache,
} from "~/lib/queries/cache";

// Basenames resolution uses Ethereum mainnet with Base coinType
// See: https://docs.base.org/base-account/framework-integrations/wagmi/basenames
const BASENAME_RESOLUTION_RPC_URL = "https://eth.llamarpc.com";

let basenameClient: ReturnType<typeof createPublicClient> | null = null;

function getBasenameClient() {
	if (!basenameClient) {
		basenameClient = createPublicClient({
			chain: mainnet,
			transport: http(BASENAME_RESOLUTION_RPC_URL),
		});
	}
	invariant(basenameClient, "Basename client not initialized");
	return basenameClient;
}

interface UseBasenameQueryOptions {
	address: string;
	enabled?: boolean;
}

/**
 * Reverse lookup: address → basename on Base L2
 * Returns the primary Basename (.base.eth) for an address
 * Uses 8-hour cache with stale-while-revalidate
 */
export const useBasenameQuery = ({
	address,
	enabled = true,
}: UseBasenameQueryOptions) => {
	const evolu = useEvolu();
	const queryClient = useQueryClient();

	// Get cached Basename from Evolu
	const cachedRows = useEvoluQuery(createBasenameCacheQuery(evolu, address));
	const cached = cachedRows[0];
	const updatedAtStr =
		cached && typeof cached.updatedAt === "string" ? cached.updatedAt : null;
	const isStale = cached ? isNameCacheStale(updatedAtStr) : true;

	// Main query: fetches fresh data (only if no cache or stale)
	const freshQuery = useQuery({
		queryKey: ["basename", address],
		queryFn: async () => {
			try {
				const client = getBasenameClient();
				const basename = await client.getEnsName({
					address: address as `0x${string}`,
					coinType: toCoinType(base.id),
				});

				// Cache the result
				await upsertBasenameCache(evolu, {
					address,
					basename,
				});

				return {
					ok: true,
					address,
					basename,
					timestamp: Date.now(),
				} as const;
			} catch (error) {
				console.error(`[Basename] Reverse lookup error:`, {
					address,
					error: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		},
		// Basenames only work for EVM addresses, disable for Tron (base58)
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
		queryKey: ["basename", "refresh", address],
		queryFn: async () => {
			console.log(`[Basename] Background refresh:`, { address });
			const client = getBasenameClient();
			const basename = await client.getEnsName({
				address: address as `0x${string}`,
				coinType: toCoinType(base.id),
			});

			// Update cache in background
			await upsertBasenameCache(evolu, {
				address,
				basename,
			});

			// Invalidate main query to trigger re-render with fresh data
			queryClient.invalidateQueries({ queryKey: ["basename", address] });

			return {
				ok: true,
				address,
				basename,
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

	// Return cached data as query-like object if fresh
	if (cached && !isStale && updatedAtStr) {
		const basename =
			cached.basename && typeof cached.basename === "string"
				? cached.basename
				: null;
		return {
			data: {
				ok: true,
				address,
				basename,
				timestamp: new Date(updatedAtStr).getTime(),
			} as const,
			isLoading: false,
		} as const;
	}

	// Otherwise return the fresh query
	return freshQuery;
};

interface UseBasenameAddressQueryOptions {
	name: string;
	enabled?: boolean;
}

/**
 * Forward lookup: basename → address on Base L2
 * Resolves a Basename (.base.eth) to its address
 * Uses 8-hour cache with stale-while-revalidate
 */
export const useBasenameAddressQuery = ({
	name,
	enabled = true,
}: UseBasenameAddressQueryOptions) => {
	const evolu = useEvolu();
	const queryClient = useQueryClient();

	// Normalize name using viem's ENSIP-15 canonical normalization
	let normalizedName: string;
	try {
		normalizedName = normalize(name);
		if (normalizedName !== name) {
			console.log(`[Basename] Name normalized:`, {
				original: name,
				normalized: normalizedName,
			});
		}
	} catch (error) {
		// If normalization fails, fall back to lowercase for basic validation
		console.warn(`[Basename] Normalization failed, using lowercase fallback:`, {
			original: name,
			error: error instanceof Error ? error.message : String(error),
		});
		normalizedName = name.toLowerCase();
	}

	// Get cached address from Evolu
	const cachedRows = useEvoluQuery(
		createBasenameAddressCacheQuery(evolu, normalizedName),
	);
	const cached = cachedRows[0];
	const updatedAtStr =
		cached && typeof cached.updatedAt === "string" ? cached.updatedAt : null;
	const isStale = cached ? isNameCacheStale(updatedAtStr) : true;

	if (cached) {
		console.log(
			`[Basename] Forward lookup cache ${isStale ? "stale" : "fresh"}:`,
			{
				name,
				normalizedName,
				cachedAddress: cached.address,
				updatedAt: cached.updatedAt,
			},
		);
	}

	// Main query: fetches fresh data (only if no cache or stale)
	const freshQuery = useQuery({
		queryKey: ["basenameAddress", normalizedName],
		queryFn: async () => {
			console.log(`[Basename] Starting forward lookup:`, {
				name,
				normalizedName,
			});
			const startTime = Date.now();

			// Validate Basename format (using normalized name for case-insensitive check)
			if (
				!normalizedName.endsWith(".base.eth") ||
				normalizedName.length < 10 ||
				normalizedName.length > 55
			) {
				console.warn(`[Basename] Invalid format:`, {
					name,
					normalizedName,
					endsWithBaseEth: normalizedName.endsWith(".base.eth"),
					length: normalizedName.length,
				});
				return {
					ok: false,
					error:
						"Invalid Basename format. Must end with .base.eth and be 10-55 characters.",
					code: "INVALID_NAME",
				} as const;
			}

			try {
				const client = getBasenameClient();
				console.log(`[Basename] Calling RPC getEnsAddress:`, {
					name: normalizedName,
					rpcUrl: BASENAME_RESOLUTION_RPC_URL,
					chain: "mainnet",
					coinType: toCoinType(base.id),
				});

				// Forward lookup: get address from Basename
				// Basenames (.base.eth) work with standard ENS resolution
				// coinType ensures we get the Base address if multichain resolution is used
				const address = await client.getEnsAddress({
					name: normalizedName,
					coinType: toCoinType(base.id),
				});

				const duration = Date.now() - startTime;

				// Cache the result (even null results are cached)
				await upsertBasenameAddressCache(evolu, {
					name: normalizedName,
					address,
				});

				// If address is null, the name exists but has no resolver or no address set
				if (!address) {
					console.warn(`[Basename] Name does not resolve to address:`, {
						name: normalizedName,
						durationMs: duration,
					});
					return {
						ok: false,
						error: `Basename "${normalizedName}" does not resolve to an address.`,
						code: "NAME_NOT_FOUND",
					} as const;
				}

				console.log(`[Basename] Forward lookup success:`, {
					name: normalizedName,
					address,
					durationMs: duration,
				});

				return {
					ok: true,
					name: normalizedName,
					address,
					timestamp: Date.now(),
				} as const;
			} catch (error) {
				const duration = Date.now() - startTime;
				console.error(`[Basename] Forward lookup error:`, {
					name,
					normalizedName,
					error: error instanceof Error ? error.message : String(error),
					errorStack: error instanceof Error ? error.stack : undefined,
					durationMs: duration,
				});
				throw error;
			}
		},
		// Only enable query if name looks like Basename (basic format check)
		enabled:
			enabled &&
			Boolean(name) &&
			normalizedName.endsWith(".base.eth") &&
			isStale,
		staleTime: 1000 * 60 * 60 * 24, // 24 hours - trust our cache more
		gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in memory for 7 days
		retry: 1,
	});

	// Background refresh: if cache is stale, start a refresh but don't block on it
	useQuery({
		queryKey: ["basenameAddress", "refresh", normalizedName],
		queryFn: async () => {
			console.log(`[Basename] Background refresh:`, { name, normalizedName });
			const client = getBasenameClient();

			const address = await client.getEnsAddress({
				name: normalizedName,
				coinType: toCoinType(base.id),
			});

			console.log(`[Basename] Background refresh complete:`, {
				name: normalizedName,
				address,
			});

			// Update cache in background
			await upsertBasenameAddressCache(evolu, {
				name: normalizedName,
				address,
			});

			// Invalidate main query to trigger re-render with fresh data
			queryClient.invalidateQueries({
				queryKey: ["basenameAddress", normalizedName],
			});

			// Return the result (error handling for background refresh)
			if (!address) {
				return {
					ok: false,
					error: `Basename "${normalizedName}" does not resolve to an address.`,
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
			normalizedName.endsWith(".base.eth") &&
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
					error: `Basename "${normalizedName}" does not resolve to an address.`,
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
