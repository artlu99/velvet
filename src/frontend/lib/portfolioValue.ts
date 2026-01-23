import type { CoinGeckoPriceMap } from "@shared/types";

export interface TokenBalance {
	readonly coinId: string;
	readonly balance: string;
}

export interface WalletWithTokens {
	readonly tokens: readonly TokenBalance[];
}

/**
 * Calculate USD value for a single token
 * @param balance - Token balance as decimal string
 * @param price - Price in USD
 * @returns USD value
 */
export function calculateTokenUsd(balance: string, price: number): number {
	return Number.parseFloat(balance) * price;
}

/**
 * Calculate total USD value for all tokens in a wallet
 * @param tokens - Array of token balances with coin IDs
 * @param prices - Price map from CoinGecko
 * @returns Total USD value (missing prices treated as $0)
 */
export function calculateWalletTotal(
	tokens: readonly TokenBalance[],
	prices: CoinGeckoPriceMap,
): number {
	let total = 0;
	for (const token of tokens) {
		const priceData = prices[token.coinId];
		if (priceData) {
			total += calculateTokenUsd(token.balance, priceData.usd);
		}
		// Missing prices are treated as $0 (not added to total)
	}
	return total;
}

/**
 * Calculate global portfolio total across all wallets
 * @param wallets - Array of wallets with their tokens
 * @param prices - Price map from CoinGecko
 * @returns Total USD value across all wallets
 */
export function calculateGlobalTotal(
	wallets: readonly WalletWithTokens[],
	prices: CoinGeckoPriceMap,
): number {
	let total = 0;
	for (const wallet of wallets) {
		total += calculateWalletTotal(wallet.tokens, prices);
	}
	return total;
}
