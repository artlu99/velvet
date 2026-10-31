import { describe, expect, mock, test } from "bun:test";
import { COIN_ID_TO_TOKEN, partitionCoinIds } from "./stupidTokens";

// Both upstreams are mocked: CoinGecko always fails (worst case for the
// fallback), stupid tokens is flag-controllable.
let stupidTokensShouldFail = false;

mock.module("./coingecko", () => ({
	fetchCoingeckoPrices: async () => {
		throw new Error("CoinGecko down");
	},
}));

mock.module("./stupidTokens", () => ({
	COIN_ID_TO_TOKEN,
	partitionCoinIds,
	fetchStupidTokenPrices: async (coinIds: readonly string[]) => {
		if (stupidTokensShouldFail) throw new Error("stupid tokens down");
		const map = new Map<string, number>();
		for (const id of coinIds) {
			map.set(COIN_ID_TO_TOKEN[id].toLowerCase(), 123.45);
		}
		return map;
	},
}));

const { fetchPrices } = await import("./prices");

describe("partitionCoinIds", () => {
	test("routes known EVM coin IDs to stupid tokens", () => {
		const { stupidTokens, coinGecko } = partitionCoinIds([
			"ethereum",
			"usd-coin",
			"tether",
		]);
		expect(stupidTokens).toEqual(["ethereum", "usd-coin", "tether"]);
		expect(coinGecko).toEqual([]);
	});

	test("routes unknown coin IDs to the CoinGecko fallback", () => {
		const { stupidTokens, coinGecko } = partitionCoinIds([
			"tron",
			"chainlink",
		]);
		expect(stupidTokens).toEqual([]);
		expect(coinGecko).toEqual(["tron", "chainlink"]);
	});

	test("splits mixed input", () => {
		const { stupidTokens, coinGecko } = partitionCoinIds([
			"ethereum",
			"tron",
			"tether",
		]);
		expect(stupidTokens).toEqual(["ethereum", "tether"]);
		expect(coinGecko).toEqual(["tron"]);
	});

	test("handles empty input", () => {
		const { stupidTokens, coinGecko } = partitionCoinIds([]);
		expect(stupidTokens).toEqual([]);
		expect(coinGecko).toEqual([]);
	});

	test("every mapped token identity is well-formed", () => {
		for (const token of Object.values(COIN_ID_TO_TOKEN)) {
			const [chainId, address] = token.split(":");
			expect(Number.isInteger(Number(chainId))).toBe(true);
			expect(address.length).toBeGreaterThan(0);
		}
	});
});

describe("fetchPrices", () => {
	const env = { COINGECKO_API_KEY: "test-key" } as Env;

	test("returns partial results when only the CoinGecko fallback fails", async () => {
		stupidTokensShouldFail = false;
		const result = await fetchPrices({
			env,
			coinIds: ["ethereum", "tron"],
		});
		expect(result.ethereum?.usd).toBe(123.45);
		expect(result.tron).toBeUndefined();
	});

	test("throws when all sources fail", async () => {
		stupidTokensShouldFail = true;
		expect(fetchPrices({ env, coinIds: ["ethereum", "tron"] })).rejects.toThrow(
			"stupid tokens down",
		);
	});
});
