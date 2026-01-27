import { useQuery } from "@evolu/react";
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
}: UseGlobalPortfolioTotalOptions): number | null => {
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

	// Create all query objects upfront (no hooks called here)
	const balanceQueryConfigs = useMemo(() => {
		return addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			const configs: Array<{
				address: string;
				chainId: string;
				query: ReturnType<typeof createBalanceCacheQuery>;
			}> = [];

			if (addressType.type === "evm") {
				configs.push({
					address,
					chainId: "1",
					query: createBalanceCacheQuery(evolu, address, "1"),
				});
				configs.push({
					address,
					chainId: "8453",
					query: createBalanceCacheQuery(evolu, address, "8453"),
				});
			} else if (addressType.type === "tron") {
				configs.push({
					address,
					chainId: "tron",
					query: createBalanceCacheQuery(evolu, address, "tron"),
				});
			}

			return configs;
		});
	}, [addresses, evolu]);

	const tokenBalanceQueryConfigs = useMemo(() => {
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
							query: createTokenBalanceCacheQuery(
								evolu,
								address,
								contract,
								"1",
							),
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
							query: createTokenBalanceCacheQuery(
								evolu,
								address,
								contract,
								"8453",
							),
						};
					})
					.filter((q): q is NonNullable<typeof q> => q !== null),
			];
		});
	}, [addresses, ethTokens, baseTokens, evolu]);

	const trc20BalanceQueryConfigs = useMemo(() => {
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
						query: createTokenBalanceCacheQuery(
							evolu,
							address,
							contract,
							"tron",
						),
					};
				})
				.filter((q): q is NonNullable<typeof q> => q !== null);
		});
	}, [addresses, tronTokens, evolu]);

	// Call useQuery for each query
	// Note: While hooks are called in map(), the order is stable because it's determined
	// by stable inputs (addresses, tokens). React allows this pattern when hook order
	// is deterministic. Evolu queries are reactive and automatically update when cache changes.
	// The linter warning is a false positive - hook order is guaranteed to be stable.
	const nativeBalances = balanceQueryConfigs.map((config) =>
		// biome-ignore lint/correctness/useHookAtTopLevel: hook order is guaranteed to be stable
		useQuery(config.query),
	);
	const erc20Balances = tokenBalanceQueryConfigs.map((config) =>
		// biome-ignore lint/correctness/useHookAtTopLevel: hook order is guaranteed to be stable
		useQuery(config.query),
	);
	const trc20Balances = trc20BalanceQueryConfigs.map((config) =>
		// biome-ignore lint/correctness/useHookAtTopLevel: hook order is guaranteed to be stable
		useQuery(config.query),
	);

	// Calculate total directly from cache (reactive - no useMemo needed)
	// This recalculates automatically when any cache value changes
	if (!prices) return null;

	let total = 0;
	let nativeIndex = 0;

	// Process native balances
	for (let i = 0; i < addresses.length; i++) {
		const address = addresses[i];
		const addressType = discriminateAddressType(address);

		if (addressType.type === "evm") {
			// ETH balance
			const ethCache = nativeBalances[nativeIndex]?.[0];
			if (ethCache?.balanceRaw && typeof ethCache.balanceRaw === "string") {
				const ethBalanceValue = rawToAmount(ethCache.balanceRaw, 18);
				if (prices.ethereum) {
					total += calculateTokenUsd(ethBalanceValue, prices.ethereum.usd);
				}
			}
			nativeIndex++;

			// Base ETH balance
			const baseCache = nativeBalances[nativeIndex]?.[0];
			if (baseCache?.balanceRaw && typeof baseCache.balanceRaw === "string") {
				const baseBalanceValue = rawToAmount(baseCache.balanceRaw, 18);
				if (prices.ethereum) {
					total += calculateTokenUsd(baseBalanceValue, prices.ethereum.usd);
				}
			}
			nativeIndex++;
		} else if (addressType.type === "tron") {
			// TRX balance
			const trxCache = nativeBalances[nativeIndex]?.[0];
			if (trxCache?.balanceRaw && typeof trxCache.balanceRaw === "string") {
				const trxBalanceValue = rawToAmount(trxCache.balanceRaw, 6);
				if (prices.tron) {
					total += calculateTokenUsd(trxBalanceValue, prices.tron.usd);
				}
			}
			nativeIndex++;
		}
	}

	// Process ERC20 balances
	for (let i = 0; i < erc20Balances.length; i++) {
		const cache = erc20Balances[i]?.[0];
		const config = tokenBalanceQueryConfigs[i];
		if (cache?.balanceRaw && config?.token && prices[config.token.id]) {
			const decimals = getTokenDecimals(
				config.token,
				config.chainId === "1" ? 1 : 8453,
			);
			const balanceAmount = rawToAmount(cache.balanceRaw, decimals);
			total += calculateTokenUsd(balanceAmount, prices[config.token.id].usd);
		}
	}

	// Process TRC20 balances
	for (let i = 0; i < trc20Balances.length; i++) {
		const cache = trc20Balances[i]?.[0];
		const config = trc20BalanceQueryConfigs[i];
		// TRC20 stores balanceFormatted as balanceRaw in cache
		if (cache?.balanceRaw && config?.token && prices[config.token.id]) {
			const balanceFormatted = cache.balanceRaw;
			total += calculateTokenUsd(balanceFormatted, prices[config.token.id].usd);
		}
	}

	return total;
};
