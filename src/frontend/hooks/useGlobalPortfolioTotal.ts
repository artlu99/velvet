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

	// Create all individual queries upfront (stable across renders)
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

	// Use useQueries to get all results reactively (follows Rules of Hooks)
	const nativeBalances = useQueries(nativeBalanceQueries);
	const erc20Balances = useQueries(erc20BalanceQueries);
	const trc20Balances = useQueries(trc20BalanceQueries);

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
	if (!prices) return null;

	let total = 0;
	let nativeIndex = 0;

	// Process native balances
	for (const address of addresses) {
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
		const config = tokenBalanceConfigs[i];
		const balanceRaw = cache?.balanceRaw;
		if (
			balanceRaw &&
			typeof balanceRaw === "string" &&
			config?.token &&
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

	// Process TRC20 balances
	for (let i = 0; i < trc20Balances.length; i++) {
		const cache = trc20Balances[i]?.[0];
		const config = trc20BalanceConfigs[i];
		const balanceRaw = cache?.balanceRaw;
		// TRC20 stores balanceFormatted as balanceRaw in cache
		if (
			balanceRaw &&
			typeof balanceRaw === "string" &&
			config?.token &&
			prices[config.token.id]
		) {
			const balanceFormatted = balanceRaw;
			total += calculateTokenUsd(balanceFormatted, prices[config.token.id].usd);
		}
	}

	return total;
};
