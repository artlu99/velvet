import type { CoinGeckoPriceMap } from "@shared/types";
import { fetcher } from "itty-fetcher";
import invariant from "tiny-invariant";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
const api = fetcher({
	base: COINGECKO_API_BASE,
	headers: {
		"User-Agent":
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
	},
});

interface FetchPricesOptions {
	readonly env: Env;
	readonly coinIds: readonly string[];
}

interface CoinGeckoErrorResponse {
	readonly error: string;
}

function isCoinGeckoErrorResponse(
	value: unknown,
): value is CoinGeckoErrorResponse {
	return (
		typeof value === "object" &&
		value !== null &&
		"error" in value &&
		typeof (value as CoinGeckoErrorResponse).error === "string"
	);
}

/**
 * Fetch prices from CoinGecko API (Free tier)
 * @param options.coinIds - Array of CoinGecko coin IDs (e.g., ["ethereum", "tron"])
 * @param options.apiKey - CoinGecko Demo API key (optional, increases rate limits)
 * @returns Map of coin IDs to USD prices
 * @throws Error on rate limit (429) or API errors (5xx)
 */
export async function fetchPrices({
	env,
	coinIds,
}: FetchPricesOptions): Promise<CoinGeckoPriceMap> {
	invariant(
		env.COINGECKO_API_KEY,
		"COINGECKO_API_KEY is not set in environment",
	);

	if (coinIds.length === 0) {
		return {};
	}

	const ids = coinIds.join(",");
	const searchParams = new URLSearchParams({
		ids,
		vs_currencies: "usd",
	});

	// Demo API key goes in query params for free tier
	searchParams.set("x-cg-demo-api-key", env.COINGECKO_API_KEY);

	try {
		const res = await api.get<CoinGeckoPriceMap>(
			`simple/price?${searchParams.toString()}`,
		);
		return res;
	} catch (error) {
		console.error("error", error);
		// itty-fetcher throws FetchError on non-OK responses
		if (
			typeof error === "object" &&
			error !== null &&
			"status" in error &&
			"response" in error
		) {
			const err = error as { status: number; response: Response };

			if (err.status === 429) {
				throw new Error("CoinGecko API rate limit exceeded");
			}

			// Try to parse error body for more details
			const responseText = await err.response.text().catch(() => "");
			if (responseText) {
				try {
					const errorData = JSON.parse(responseText);
					if (isCoinGeckoErrorResponse(errorData)) {
						throw new Error(
							`CoinGecko API error: ${err.status} ${err.response.statusText}: ${errorData.error}`,
						);
					}
				} catch {
					// JSON parse failed, use raw response text
					throw new Error(
						`CoinGecko API error: ${err.status} ${err.response.statusText}: ${responseText}`,
					);
				}
			}

			throw new Error(
				`CoinGecko API error: ${err.status} ${err.response.statusText}`,
			);
		}

		// Re-throw network errors or unknown errors
		throw error;
	}
}
