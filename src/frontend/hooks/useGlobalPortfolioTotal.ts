import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import { useQueries } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";
import { useMemo } from "react";
import {
	DEFAULT_COIN_IDS,
	usePricesQuery,
} from "~/hooks/queries/usePricesQuery";
import { discriminateAddressType } from "~/lib/crypto";
import { calculateTokenUsd } from "~/lib/portfolioValue";
import { useTokenStore } from "~/providers/tokenStore";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UseGlobalPortfolioTotalOptions {
	readonly addresses: ReadonlyArray<string>;
}

/**
 * Custom hook to calculate the total USD value across all wallets.
 * This is used for displaying the global portfolio total.
 *
 * Returns the global portfolio total in USD, or null if prices haven't loaded yet.
 */
export const useGlobalPortfolioTotal = ({
	addresses,
}: UseGlobalPortfolioTotalOptions): number | null => {
	// Fetch prices for all tokens
	const { data: pricesData } = usePricesQuery({
		coinIds: DEFAULT_COIN_IDS,
	});

	// Get all tokens
	const getTokensByChain = useTokenStore((state) => state.getTokensByChain);
	const ethTokens = getTokensByChain(1);
	const baseTokens = getTokensByChain(8453);
	const tronTokens = getTokensByChain("tron");

	// Query all native balances for all addresses
	const ethBalances = useQueries({
		queries: addresses.map((address) => {
			const addressType = discriminateAddressType(address);
			return {
				queryKey: ["balance", address, 1],
				queryFn: async () => {
					const url = buildUrl(apiEndpoints.balance.path, {
						address,
						query: { chainId: "1" },
					});
					return api.get<ApiResponses["balance"]>(url);
				},
				enabled: addressType.type === "evm",
				staleTime: 1000 * 60 * 5, // 5 minutes
			};
		}),
	});

	const baseBalances = useQueries({
		queries: addresses.map((address) => {
			const addressType = discriminateAddressType(address);
			return {
				queryKey: ["balance", address, 8453],
				queryFn: async () => {
					const url = buildUrl(apiEndpoints.balance.path, {
						address,
						query: { chainId: "8453" },
					});
					return api.get<ApiResponses["balance"]>(url);
				},
				enabled: addressType.type === "evm",
				staleTime: 1000 * 60 * 5, // 5 minutes
			};
		}),
	});

	const trxBalances = useQueries({
		queries: addresses.map((address) => {
			const addressType = discriminateAddressType(address);
			return {
				queryKey: ["tronBalance", address],
				queryFn: async () => {
					const url = buildUrl(apiEndpoints.tronBalance.path, {
						address,
					});
					return api.get<ApiResponses["tronBalance"]>(url);
				},
				enabled: addressType.type === "tron",
				staleTime: 1000 * 60 * 5, // 5 minutes
			};
		}),
	});

	// Query all ERC20/TRC20 balances for all addresses
	const allErc20Balances = useQueries({
		queries: addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "evm") return [];

			return [
				...ethTokens.map((token) => ({
					queryKey: ["erc20Balance", address, token.platforms.ethereum, 1],
					queryFn: async () => {
						const url = buildUrl(apiEndpoints.erc20Balance.path, {
							address,
							contract: token.platforms.ethereum,
							query: { chainId: "1" },
						});
						return api.get<ApiResponses["erc20Balance"]>(url);
					},
					staleTime: 1000 * 60 * 5,
				})),
				...baseTokens.map((token) => ({
					queryKey: ["erc20Balance", address, token.platforms.base, 8453],
					queryFn: async () => {
						const url = buildUrl(apiEndpoints.erc20Balance.path, {
							address,
							contract: token.platforms.base,
							query: { chainId: "8453" },
						});
						return api.get<ApiResponses["erc20Balance"]>(url);
					},
					staleTime: 1000 * 60 * 5,
				})),
			];
		}),
	});

	const allTrc20Balances = useQueries({
		queries: addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "tron") return [];

			return tronTokens.map((token) => ({
				queryKey: ["trc20Balance", address, token.platforms.tron],
				queryFn: async () => {
					const url = buildUrl(apiEndpoints.trc20Balance.path, {
						address,
						contract: token.platforms.tron,
					});
					return api.get<ApiResponses["trc20Balance"]>(url);
				},
				staleTime: 1000 * 60 * 5,
			}));
		}),
	});

	// Calculate global portfolio total
	const globalTotalUsd = useMemo(() => {
		if (!pricesData?.ok || !pricesData.prices) return null;

		let total = 0;
		let erc20BalanceIndex = 0;
		let trc20BalanceIndex = 0;

		for (let i = 0; i < addresses.length; i++) {
			const address = addresses[i];
			const addressType = discriminateAddressType(address);

			// Add native ETH if loaded
			const ethBalanceData = ethBalances[i].data;
			if (
				addressType.type === "evm" &&
				ethBalanceData?.ok &&
				pricesData.prices.ethereum
			) {
				total += calculateTokenUsd(
					ethBalanceData.balanceEth,
					pricesData.prices.ethereum.usd,
				);
			}

			// Add native Base ETH if loaded
			const baseBalanceData = baseBalances[i].data;
			if (
				addressType.type === "evm" &&
				baseBalanceData?.ok &&
				pricesData.prices.ethereum
			) {
				total += calculateTokenUsd(
					baseBalanceData.balanceEth,
					pricesData.prices.ethereum.usd,
				);
			}

			// Add native TRX if loaded
			const trxBalanceData = trxBalances[i].data;
			if (
				addressType.type === "tron" &&
				trxBalanceData?.ok &&
				pricesData.prices.tron
			) {
				total += calculateTokenUsd(
					trxBalanceData.balanceTrx,
					pricesData.prices.tron.usd,
				);
			}

			// Add ERC20 tokens (only for EVM addresses)
			if (addressType.type === "evm") {
				// ETH tokens
				for (let j = 0; j < ethTokens.length; j++) {
					const token = ethTokens[j];
					const balance = allErc20Balances[erc20BalanceIndex];
					if (balance?.data?.ok && pricesData.prices[token.id]) {
						const decimals =
							token.detail_platforms.ethereum?.decimal_place ?? 18;
						const balanceAmount = (
							Number(balance.data.balanceRaw) /
							10 ** decimals
						).toString();
						total += calculateTokenUsd(
							balanceAmount,
							pricesData.prices[token.id].usd,
						);
					}
					erc20BalanceIndex++;
				}

				// Base tokens
				for (let j = 0; j < baseTokens.length; j++) {
					const token = baseTokens[j];
					const balance = allErc20Balances[erc20BalanceIndex];
					if (balance?.data?.ok && pricesData.prices[token.id]) {
						const decimals = token.detail_platforms.base?.decimal_place ?? 18;
						const balanceAmount = (
							Number(balance.data.balanceRaw) /
							10 ** decimals
						).toString();
						total += calculateTokenUsd(
							balanceAmount,
							pricesData.prices[token.id].usd,
						);
					}
					erc20BalanceIndex++;
				}
			}

			// Add TRC20 tokens (only for Tron addresses)
			if (addressType.type === "tron") {
				for (let j = 0; j < tronTokens.length; j++) {
					const token = tronTokens[j];
					const balance = allTrc20Balances[trc20BalanceIndex];
					if (balance?.data?.ok && pricesData.prices[token.id]) {
						total += calculateTokenUsd(
							balance.data.balanceFormatted,
							pricesData.prices[token.id].usd,
						);
					}
					trc20BalanceIndex++;
				}
			}
		}

		return total;
	}, [
		addresses,
		pricesData,
		ethBalances,
		baseBalances,
		trxBalances,
		allErc20Balances,
		allTrc20Balances,
		ethTokens,
		baseTokens,
		tronTokens,
	]);

	return globalTotalUsd;
};
