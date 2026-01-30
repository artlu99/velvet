import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import type { BalanceResult, TronBalanceResult } from "@shared/types";
import { useQueries } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";
import { useMemo } from "react";
import { usePricesQuery } from "~/hooks/queries/usePricesQuery";
import { discriminateAddressType } from "~/lib/crypto";
import { calculateTokenUsd } from "~/lib/portfolioValue";
import { rawToAmount } from "~/lib/transaction";
import { useTokenStore } from "~/providers/tokenStore";

interface UseGlobalPortfolioTotalOptions {
	readonly addresses: ReadonlyArray<string>;
	readonly filterMap?: ReadonlyMap<string, boolean>;
}

const api = fetcher({ base: `${window.location.origin}/api` });
const FIVE_MINUTES_MS = 1000 * 60 * 5;

/**
 * Custom hook to calculate the total USD value across all wallets.
 * No persistence layer: reads directly from live API queries (TanStack Query).
 *
 * Returns the global portfolio total in USD, or null until prices are available.
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

	// Get all tokens
	const getTokensByChain = useTokenStore((state) => state.getTokensByChain);
	const ethTokens = getTokensByChain(1);
	const baseTokens = getTokensByChain(8453);
	const tronTokens = getTokensByChain("tron");

	// Prices: include native assets plus all token IDs in the store
	const coinIds = useMemo(() => {
		const ids = new Set<string>(["ethereum", "tron"]);
		for (const t of ethTokens) ids.add(t.id);
		for (const t of baseTokens) ids.add(t.id);
		for (const t of tronTokens) ids.add(t.id);
		return Array.from(ids);
	}, [ethTokens, baseTokens, tronTokens]);

	const pricesQuery = usePricesQuery({
		coinIds,
		enabled: filteredAddresses.length > 0 && coinIds.length > 0,
	});

	const prices = pricesQuery.data?.ok ? pricesQuery.data.prices : null;

	const nativeQueryConfigs = useMemo(() => {
		return filteredAddresses.flatMap(
			(
				address,
			): Array<
				| {
						queryKey: readonly ["balance", string, 1 | 8453, false];
						queryFn: () => Promise<BalanceResult>;
						enabled: boolean;
						staleTime: number;
				  }
				| {
						queryKey: readonly ["tronBalance", string, false];
						queryFn: () => Promise<TronBalanceResult>;
						enabled: boolean;
						staleTime: number;
				  }
			> => {
				const addressType = discriminateAddressType(address);
				if (addressType.type === "evm") {
					const makeBalanceQuery = (chainId: 1 | 8453) => ({
						queryKey: ["balance", address, chainId, false] as const,
						queryFn: async () => {
							const url = buildUrl(apiEndpoints.balance.path, {
								address,
								query: { chainId: String(chainId) },
							});
							return api.get<ApiResponses["balance"]>(url);
						},
						enabled: Boolean(address),
						staleTime: FIVE_MINUTES_MS,
					});
					return [makeBalanceQuery(1), makeBalanceQuery(8453)];
				}

				if (addressType.type === "tron") {
					return [
						{
							queryKey: ["tronBalance", address, false] as const,
							queryFn: async () => {
								const url = buildUrl(apiEndpoints.tronBalance.path, {
									address,
								});
								return api.get<ApiResponses["tronBalance"]>(url);
							},
							enabled: Boolean(address),
							staleTime: FIVE_MINUTES_MS,
						},
					];
				}

				return [];
			},
		);
	}, [filteredAddresses]);

	const erc20Configs = useMemo(() => {
		return filteredAddresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "evm") return [];

			const eth = ethTokens
				.filter((token) => token.platforms.ethereum)
				.map((token) => ({
					address,
					chainId: 1 as const,
					contract: token.platforms.ethereum,
					tokenId: token.id,
				}));

			const base = baseTokens
				.filter((token) => token.platforms.base)
				.map((token) => ({
					address,
					chainId: 8453 as const,
					contract: token.platforms.base,
					tokenId: token.id,
				}));

			return [...eth, ...base].filter((x) => Boolean(x.contract));
		});
	}, [filteredAddresses, ethTokens, baseTokens]);

	const erc20QueryConfigs = useMemo(() => {
		return erc20Configs.map(({ address, contract, chainId }) => ({
			queryKey: ["erc20Balance", address, contract, chainId] as const,
			queryFn: async () => {
				const url = buildUrl(apiEndpoints.erc20Balance.path, {
					address,
					contract,
					query: { chainId: String(chainId) },
				});
				return api.get<ApiResponses["erc20Balance"]>(url);
			},
			enabled: Boolean(address) && Boolean(contract),
			staleTime: FIVE_MINUTES_MS,
		}));
	}, [erc20Configs]);

	const trc20Configs = useMemo(() => {
		return filteredAddresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "tron") return [];

			return tronTokens
				.filter((token) => token.platforms.tron)
				.map((token) => ({
					address,
					contract: token.platforms.tron,
					tokenId: token.id,
				}))
				.filter((x) => Boolean(x.contract));
		});
	}, [filteredAddresses, tronTokens]);

	const trc20QueryConfigs = useMemo(() => {
		return trc20Configs.map(({ address, contract }) => ({
			queryKey: ["trc20Balance", address, contract, false] as const,
			queryFn: async () => {
				const url = buildUrl(apiEndpoints.trc20Balance.path, {
					address,
					contract,
				});
				return api.get<ApiResponses["trc20Balance"]>(url);
			},
			enabled: Boolean(address) && Boolean(contract),
			staleTime: FIVE_MINUTES_MS,
		}));
	}, [trc20Configs]);

	const nativeBalances = useQueries({ queries: nativeQueryConfigs });
	const erc20Balances = useQueries({ queries: erc20QueryConfigs });
	const trc20Balances = useQueries({ queries: trc20QueryConfigs });

	// Match existing behavior: treat "no wallets" as "no total"
	if (filteredAddresses.length === 0) return null;
	if (!prices) return null;

	let total = 0;

	// Native balances (order matches nativeQueryConfigs)
	for (const q of nativeBalances) {
		const data = q.data;
		if (!data || !data.ok) continue;
		// EVM native
		if ("balanceWei" in data) {
			const eth = rawToAmount(data.balanceWei, 18);
			const price = prices.ethereum?.usd;
			if (price != null) total += calculateTokenUsd(eth, price);
			continue;
		}
		// Tron native
		if ("balanceSun" in data) {
			const trx = rawToAmount(data.balanceSun, 6);
			const price = prices.tron?.usd;
			if (price != null) total += calculateTokenUsd(trx, price);
		}
	}

	// ERC20 balances
	for (let i = 0; i < erc20Balances.length; i++) {
		const data = erc20Balances[i]?.data;
		const tokenId = erc20Configs[i]?.tokenId;
		if (!data || !data.ok || !tokenId) continue;
		const price = prices[tokenId]?.usd;
		if (price == null) continue;
		total += calculateTokenUsd(data.balanceFormatted, price);
	}

	// TRC20 balances
	for (let i = 0; i < trc20Balances.length; i++) {
		const data = trc20Balances[i]?.data;
		const tokenId = trc20Configs[i]?.tokenId;
		if (!data || !data.ok || !tokenId) continue;
		const price = prices[tokenId]?.usd;
		if (price == null) continue;
		total += calculateTokenUsd(data.balanceFormatted, price);
	}

	return total;
};
