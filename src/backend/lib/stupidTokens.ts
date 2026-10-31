/**
 * Client for stupid tokens (tokens.stupidtech.net) — free, unauthenticated
 * bulk USD pricing keyed by {chainId, address} instead of CoinGecko coin IDs.
 *
 * Token identity here is "chainId:address" (native currencies use the literal
 * address "native"). See https://tokens.stupidtech.net for the API contract.
 */

import { fetcher } from "itty-fetcher";

const STUPID_TOKENS_API_BASE = "https://tokens.stupidtech.net/v1";

const api = fetcher({ base: STUPID_TOKENS_API_BASE });

/** Maximum tokens per /v1/prices request (API limit). */
const MAX_TOKENS_PER_REQUEST = 50;

/**
 * Maps CoinGecko coin IDs to their canonical stupid tokens identity.
 * Prices are per-asset, so one canonical listing per coin ID is enough
 * (e.g. "usd-coin" maps to mainnet USDC; the Base listing is the same asset).
 * Ids absent from this map (e.g. "tron" — not supported, EVM-only) fall back
 * to CoinGecko in lib/prices.ts.
 */
export const COIN_ID_TO_TOKEN: Record<string, string> = {
	ethereum: "1:native",
	"usd-coin": "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
	tether: "1:0xdac17f958d2ee523a2206206994597c13d831ec7",
};

interface StupidTokenPriceEntry {
	readonly chainId: number;
	readonly address: string;
	readonly status: string;
	readonly priceUsd: string | null;
}

interface StupidTokenPricesResponse {
	readonly currency: string;
	readonly prices: readonly StupidTokenPriceEntry[];
}

/**
 * Split coin IDs into those resolvable via stupid tokens and those that
 * need the CoinGecko fallback.
 */
export function partitionCoinIds(coinIds: readonly string[]): {
	stupidTokens: string[];
	coinGecko: string[];
} {
	const stupidTokens: string[] = [];
	const coinGecko: string[] = [];
	for (const id of coinIds) {
		if (COIN_ID_TO_TOKEN[id] !== undefined) {
			stupidTokens.push(id);
		} else {
			coinGecko.push(id);
		}
	}
	return { stupidTokens, coinGecko };
}

/**
 * Fetch bulk USD prices from stupid tokens for the given coin IDs.
 * @param coinIds - CoinGecko coin IDs resolvable via COIN_ID_TO_TOKEN
 * @returns Map of "chainId:address" (lowercased) to USD price
 * @throws Error on rate limit (429) or API errors
 */
export async function fetchStupidTokenPrices(
	coinIds: readonly string[],
): Promise<Map<string, number>> {
	const tokens = coinIds
		.map((id) => COIN_ID_TO_TOKEN[id])
		.filter((token): token is string => token !== undefined);
	if (tokens.length === 0) {
		return new Map();
	}

	const prices = new Map<string, number>();

	// API accepts up to 50 tokens per request
	for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_REQUEST) {
		const batch = tokens.slice(i, i + MAX_TOKENS_PER_REQUEST);
		const searchParams = new URLSearchParams({ tokens: batch.join(",") });

		try {
			const res = await api.get<StupidTokenPricesResponse>(
				`prices?${searchParams.toString()}`,
			);
			for (const entry of res.prices) {
				if (entry.priceUsd === null) continue;
				const price = Number.parseFloat(entry.priceUsd);
				if (!Number.isFinite(price)) continue;
				// Addresses are case-insensitive; normalize for lookup
				const key = `${entry.chainId}:${entry.address.toLowerCase()}`;
				prices.set(key, price);
			}
		} catch (error) {
			console.error("error", error);
			if (typeof error === "object" && error !== null && "status" in error) {
				const err = error as { status: number };
				if (err.status === 429) {
					throw new Error("stupid tokens API rate limit exceeded");
				}
				throw new Error(`stupid tokens API error: ${err.status}`);
			}
			// Re-throw network errors or unknown errors
			throw error;
		}
	}

	return prices;
}
