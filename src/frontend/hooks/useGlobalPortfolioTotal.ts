import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import {
	DEFAULT_COIN_IDS,
	usePricesQuery,
} from "~/hooks/queries/usePricesQuery";
import { discriminateAddressType } from "~/lib/crypto";
import { calculateTokenUsd } from "~/lib/portfolioValue";
import { useTokenStore } from "~/providers/tokenStore";

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
				enabled: addressType.type === "evm",
				staleTime: 1000 * 60 * 5, // 5 minutes
			};
		}),
	}) as Array<{ data?: { ok: boolean; balanceEth: string } }>;

	const baseBalances = useQueries({
		queries: addresses.map((address) => {
			const addressType = discriminateAddressType(address);
			return {
				queryKey: ["balance", address, 8453],
				enabled: addressType.type === "evm",
				staleTime: 1000 * 60 * 5, // 5 minutes
			};
		}),
	}) as Array<{ data?: { ok: boolean; balanceEth: string } }>;

	const trxBalances = useQueries({
		queries: addresses.map((address) => {
			const addressType = discriminateAddressType(address);
			return {
				queryKey: ["tronBalance", address],
				enabled: addressType.type === "tron",
				staleTime: 1000 * 60 * 5, // 5 minutes
			};
		}),
	}) as Array<{ data?: { ok: boolean; balanceTrx: string } }>;

	// Query all ERC20/TRC20 balances for all addresses
	// Note: This is simplified - in production you might want to batch these differently
	const allErc20Balances = useQueries({
		queries: addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "evm") return [];

			return [
				...ethTokens.map((token) => ({
					queryKey: ["erc20Balance", address, token.platforms.ethereum, 1],
					staleTime: 1000 * 60 * 5,
				})),
				...baseTokens.map((token) => ({
					queryKey: ["erc20Balance", address, token.platforms.base, 8453],
					staleTime: 1000 * 60 * 5,
				})),
			];
		}),
	}) as Array<{ data?: { ok: boolean; balanceRaw: string } }>;

	const allTrc20Balances = useQueries({
		queries: addresses.flatMap((address) => {
			const addressType = discriminateAddressType(address);
			if (addressType.type !== "tron") return [];

			return tronTokens.map((token) => ({
				queryKey: ["trc20Balance", address, token.platforms.tron],
				staleTime: 1000 * 60 * 5,
			}));
		}),
	}) as Array<{ data?: { ok: boolean; balanceFormatted: string } }>;

	// Calculate global portfolio total
	const globalTotalUsd = useMemo(() => {
		if (!pricesData?.ok || !pricesData.prices) return null;

		let total = 0;
		let evmAddressIndex = 0; // Track index for EVM addresses in the flatMap result

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
				const tokensPerEvmAddress = ethTokens.length + baseTokens.length;
				const baseIndex = evmAddressIndex * tokensPerEvmAddress;

				// ETH tokens
				for (let j = 0; j < ethTokens.length; j++) {
					const token = ethTokens[j];
					const balanceIndex = baseIndex + j;
					const balance = allErc20Balances[balanceIndex];
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
				}

				// Base tokens
				for (let j = 0; j < baseTokens.length; j++) {
					const token = baseTokens[j];
					const balanceIndex = baseIndex + ethTokens.length + j;
					const balance = allErc20Balances[balanceIndex];
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
				}

				evmAddressIndex++;
			}

			// Add TRC20 tokens (only for Tron addresses)
			if (addressType.type === "tron") {
				for (let j = 0; j < tronTokens.length; j++) {
					const token = tronTokens[j];
					const balanceIndexTrc20 = i * tronTokens.length + j;
					const balance = allTrc20Balances[balanceIndexTrc20];
					if (balance?.data?.ok && pricesData.prices[token.id]) {
						total += calculateTokenUsd(
							balance.data.balanceFormatted,
							pricesData.prices[token.id].usd,
						);
					}
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
