/**
 * Price fetching for the /api/prices endpoint.
 *
 * Primary source is stupid tokens (EVM assets — free, no API key, generous
 * limits, see lib/stupidTokens.ts). Coin IDs it can't serve (e.g. "tron",
 * which is not EVM) fall back to CoinGecko.
 */

import type { CoinGeckoPriceMap } from "@shared/types";
import { fetchCoingeckoPrices } from "./coingecko";
import {
	COIN_ID_TO_TOKEN,
	fetchStupidTokenPrices,
	partitionCoinIds,
} from "./stupidTokens";

interface FetchPricesOptions {
	readonly env: Env;
	readonly coinIds: readonly string[];
}

/**
 * Fetch USD prices for the given CoinGecko coin IDs.
 * @returns Map of coin IDs to USD prices (ids with no known price are omitted)
 * @throws Error when all upstream sources fail
 */
export async function fetchPrices({
	env,
	coinIds,
}: FetchPricesOptions): Promise<CoinGeckoPriceMap> {
	if (coinIds.length === 0) {
		return {};
	}

	const { stupidTokens, coinGecko } = partitionCoinIds(coinIds);

	const [stupidSettled, coinGeckoSettled] = await Promise.allSettled([
		fetchStupidTokenPrices(stupidTokens),
		// Only hits CoinGecko (and requires COINGECKO_API_KEY) when needed
		coinGecko.length > 0
			? fetchCoingeckoPrices({ env, coinIds: coinGecko })
			: Promise.resolve({} as CoinGeckoPriceMap),
	]);

	if (
		stupidSettled.status === "rejected" &&
		(coinGeckoSettled.status === "rejected" || coinGecko.length === 0)
	) {
		// Both sources failed (or nothing to fall back to) — surface the error
		throw stupidSettled.reason;
	}

	const result: CoinGeckoPriceMap =
		coinGeckoSettled.status === "fulfilled"
			? { ...coinGeckoSettled.value }
			: {};
	if (stupidSettled.status === "fulfilled") {
		for (const [coinId, token] of Object.entries(COIN_ID_TO_TOKEN)) {
			const price = stupidSettled.value.get(token.toLowerCase());
			if (price !== undefined) {
				result[coinId] = { usd: price };
			}
		}
	}
	return result;
}
