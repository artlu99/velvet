import { describe, expect, test } from "bun:test";
import { COIN_ID_TO_TOKEN, partitionCoinIds } from "./stupidTokens";

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
