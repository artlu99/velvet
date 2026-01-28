import { useQueries, useQuery } from "@evolu/react";
import { useMemo } from "react";
import { discriminateAddressType } from "~/lib/crypto";
import { useEvolu } from "~/lib/evolu";
import { calculateTokenUsd } from "~/lib/portfolioValue";
import {
	createAllPricesCacheQuery,
	createBalanceCacheQuery,
	createTokenBalanceCacheQuery,
} from "~/lib/queries/cache";
import { getTokenDecimals } from "~/lib/tokenUtils";
import { rawToAmount } from "~/lib/transaction";
import { useTokenStore } from "~/providers/tokenStore";

interface UseGlobalPortfolioTotalOptions {
	readonly addresses: ReadonlyArray<string>;
	readonly filterMap?: ReadonlyMap<string, boolean>;
}

/**
 * Custom hook to calculate the total USD value across all wallets.
 * Reads directly from Evolu cache (single source of truth).
 * Automatically reactive to cache updates - no useMemo needed.
 *
 * Returns the global portfolio total in USD, or null if prices haven't loaded yet.
 */
export const useGlobalPortfolioTotal = ({
	addresses,
	filterMap,
}: UseGlobalPortfolioTotalOptions): number | null => {
	// Filter addresses if filterMap is provided (for watch-only toggle)
	const filteredAddresses = useMemo(() => {
		if (!filterMap) return addresses;
		return addresses.filter((addr) => filterMap.get(addr) === true);
	}, [addresses, filterMap]);
	const evolu = useEvolu();

	// Read prices directly from Evolu cache (single source of truth)
	const allPricesCache = useQuery(createAllPricesCacheQuery(evolu));
	const prices = useMemo(() => {
		const priceMap: Record<string, { usd: number }> = {};
		for (const priceRow of allPricesCache) {
			if (priceRow.coinId && priceRow.priceUsd !== null) {
				priceMap[priceRow.coinId] = { usd: priceRow.priceUsd };
			}
		}
		return Object.keys(priceMap).length > 0 ? priceMap : null;
	}, [allPricesCache]);

	// Get all tokens
	const getTokensByChain = useTokenStore((state) => state.getTokensByChain);
	const ethTokens = getTokensByChain(1);
	const baseTokens = getTokensByChain(8453);
	const tronTokens = getTokensByChain("tron");

	// Create all individual queries upfront (stable across renders)
	// Use addresses (not filteredAddresses) to maintain stable query count
	const nativeBalanceQueries = useMemo(() => {
		return addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			const queries: ReturnType<typeof createBalanceCacheQuery>[] = [];

			if (addressType.type === "evm") {
				queries.push(createBalanceCacheQuery(evolu, address, "1"));
				queries.push(createBalanceCacheQuery(evolu, address, "8453"));
			} else if (addressType.type === "tron") {
				queries.push(createBalanceCacheQuery(evolu, address, "tron"));
			}

			return queries;
		});
	}, [addresses, evolu]);

	const erc20BalanceQueries = useMemo(() => {
		return addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "evm") return [];

			return [
				...ethTokens
					.filter((token) => token.platforms.ethereum)
					.map((token) => {
						const contract = token.platforms.ethereum;
						if (!contract) return null;
						return createTokenBalanceCacheQuery(evolu, address, contract, "1");
					})
					.filter((q): q is NonNullable<typeof q> => q !== null),
				...baseTokens
					.filter((token) => token.platforms.base)
					.map((token) => {
						const contract = token.platforms.base;
						if (!contract) return null;
						return createTokenBalanceCacheQuery(
							evolu,
							address,
							contract,
							"8453",
						);
					})
					.filter((q): q is NonNullable<typeof q> => q !== null),
			];
		});
	}, [addresses, ethTokens, baseTokens, evolu]);

	const trc20BalanceQueries = useMemo(() => {
		return addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "tron") return [];

			return tronTokens
				.filter((token) => token.platforms.tron)
				.map((token) => {
					const contract = token.platforms.tron;
					if (!contract) return null;
					return createTokenBalanceCacheQuery(evolu, address, contract, "tron");
				})
				.filter((q): q is NonNullable<typeof q> => q !== null);
		});
	}, [addresses, tronTokens, evolu]);

	// Ensure arrays are always defined (useMemo should always return arrays, but defensive)
	// Must always call useQueries unconditionally (Rules of Hooks)
	const nativeQueries = nativeBalanceQueries ?? [];
	const erc20Queries = erc20BalanceQueries ?? [];
	const trc20Queries = trc20BalanceQueries ?? [];

	// Always call useQueries - Evolu requires stable query count, but we handle empty arrays
	const nativeBalances = useQueries(nativeQueries);
	const erc20Balances = useQueries(erc20Queries);
	const trc20Balances = useQueries(trc20Queries);

	// Create configs for processing (used for token metadata lookup)
	const tokenBalanceConfigs = useMemo(() => {
		return addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "evm") return [];

			return [
				...ethTokens
					.filter((token) => token.platforms.ethereum)
					.map((token) => {
						const contract = token.platforms.ethereum;
						if (!contract) return null;
						return {
							address,
							contract,
							chainId: "1" as const,
							token,
						};
					})
					.filter((q): q is NonNullable<typeof q> => q !== null),
				...baseTokens
					.filter((token) => token.platforms.base)
					.map((token) => {
						const contract = token.platforms.base;
						if (!contract) return null;
						return {
							address,
							contract,
							chainId: "8453" as const,
							token,
						};
					})
					.filter((q): q is NonNullable<typeof q> => q !== null),
			];
		});
	}, [addresses, ethTokens, baseTokens]);

	const trc20BalanceConfigs = useMemo(() => {
		return addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "tron") return [];

			return tronTokens
				.filter((token) => token.platforms.tron)
				.map((token) => {
					const contract = token.platforms.tron;
					if (!contract) return null;
					return {
						address,
						contract,
						token,
					};
				})
				.filter((q): q is NonNullable<typeof q> => q !== null);
		});
	}, [addresses, tronTokens]);

	// Calculate total directly from cache (reactive - no useMemo needed)
	// This recalculates automatically when any cache value changes
	// Early return if no prices or no filtered addresses
	if (!prices || filteredAddresses.length === 0) return null;

	let total = 0;

	// Process native balances - iterate filtered addresses but use full index
	// We need to map filtered addresses back to their position in the full addresses array
	const addressToIndex = new Map<string, number>();
	let currentIndex = 0;
	for (const address of addresses) {
		const addressType = discriminateAddressType(address);
		addressToIndex.set(address, currentIndex);
		if (addressType.type === "evm") {
			currentIndex += 2; // ETH + Base
		} else if (addressType.type === "tron") {
			currentIndex += 1; // TRX
		}
	}

	// Process native balances for filtered addresses only
	for (const address of filteredAddresses) {
		const addressType = discriminateAddressType(address);
		const index = addressToIndex.get(address);
		if (index === undefined) continue;

		if (addressType.type === "evm") {
			// ETH balance
			const ethCache = nativeBalances[index]?.[0];
			if (ethCache?.balanceRaw && typeof ethCache.balanceRaw === "string") {
				const ethBalanceValue = rawToAmount(ethCache.balanceRaw, 18);
				if (prices.ethereum) {
					total += calculateTokenUsd(ethBalanceValue, prices.ethereum.usd);
				}
			}

			// Base ETH balance
			const baseCache = nativeBalances[index + 1]?.[0];
			if (baseCache?.balanceRaw && typeof baseCache.balanceRaw === "string") {
				const baseBalanceValue = rawToAmount(baseCache.balanceRaw, 18);
				if (prices.ethereum) {
					total += calculateTokenUsd(baseBalanceValue, prices.ethereum.usd);
				}
			}
		} else if (addressType.type === "tron") {
			// TRX balance
			const trxCache = nativeBalances[index]?.[0];
			if (trxCache?.balanceRaw && typeof trxCache.balanceRaw === "string") {
				const trxBalanceValue = rawToAmount(trxCache.balanceRaw, 6);
				if (prices.tron) {
					total += calculateTokenUsd(trxBalanceValue, prices.tron.usd);
				}
			}
		}
	}

	// Process ERC20 balances - only for filtered addresses
	const filteredAddressSet = new Set(filteredAddresses);
	for (let i = 0; i < erc20Balances.length; i++) {
		const cache = erc20Balances[i]?.[0];
		const config = tokenBalanceConfigs[i];
		const balanceRaw = cache?.balanceRaw;
		// Only process if address is in filtered set
		if (
			balanceRaw &&
			typeof balanceRaw === "string" &&
			config?.token &&
			config?.address &&
			filteredAddressSet.has(config.address) &&
			prices[config.token.id]
		) {
			const decimals = getTokenDecimals(
				config.token,
				config.chainId === "1" ? 1 : 8453,
			);
			const balanceAmount = rawToAmount(balanceRaw, decimals);
			total += calculateTokenUsd(balanceAmount, prices[config.token.id].usd);
		}
	}

	// Process TRC20 balances - only for filtered addresses
	for (let i = 0; i < trc20Balances.length; i++) {
		const cache = trc20Balances[i]?.[0];
		const config = trc20BalanceConfigs[i];
		const balanceRaw = cache?.balanceRaw;
		// TRC20 stores balanceFormatted as balanceRaw in cache
		// Only process if address is in filtered set
		if (
			balanceRaw &&
			typeof balanceRaw === "string" &&
			config?.token &&
			config?.address &&
			filteredAddressSet.has(config.address) &&
			prices[config.token.id]
		) {
			const balanceFormatted = balanceRaw;
			total += calculateTokenUsd(balanceFormatted, prices[config.token.id].usd);
		}
	}

	return total;
};
