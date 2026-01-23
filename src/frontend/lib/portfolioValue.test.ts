import { describe, expect, test } from "bun:test";
import type { CoinGeckoPriceMap } from "@shared/types";

describe("calculateTokenUsd", () => {
	test("calculates USD value for token with decimals", async () => {
		const { calculateTokenUsd } = await import("./portfolioValue");
		const result = calculateTokenUsd("1.5", 3000);
		expect(result).toBe(4500);
	});

	test("handles zero balance", async () => {
		const { calculateTokenUsd } = await import("./portfolioValue");
		const result = calculateTokenUsd("0", 100);
		expect(result).toBe(0);
	});

	test("handles small decimal amounts", async () => {
		const { calculateTokenUsd } = await import("./portfolioValue");
		const result = calculateTokenUsd("0.001", 2000);
		expect(result).toBe(2);
	});

	test("handles very small prices", async () => {
		const { calculateTokenUsd } = await import("./portfolioValue");
		const result = calculateTokenUsd("100", 0.12);
		expect(result).toBe(12);
	});
});

describe("calculateWalletTotal", () => {
	test("sums token values correctly", async () => {
		const { calculateWalletTotal } = await import("./portfolioValue");

		const tokens = [
			{ coinId: "ethereum", balance: "1.5" },
			{ coinId: "usd-coin", balance: "100" },
		];

		const prices: CoinGeckoPriceMap = {
			ethereum: { usd: 3000 },
			"usd-coin": { usd: 1.0 },
		};

		const result = calculateWalletTotal(tokens, prices);
		expect(result).toBe(4600); // (1.5 * 3000) + (100 * 1) = 4500 + 100 = 4600
	});

	test("handles missing prices gracefully", async () => {
		const { calculateWalletTotal } = await import("./portfolioValue");

		const tokens = [
			{ coinId: "ethereum", balance: "1" },
			{ coinId: "unknown-token", balance: "100" },
		];

		const prices: CoinGeckoPriceMap = {
			ethereum: { usd: 3000 },
			// unknown-token price is missing
		};

		const result = calculateWalletTotal(tokens, prices);
		expect(result).toBe(3000); // Only ethereum counted
	});

	test("handles empty token list", async () => {
		const { calculateWalletTotal } = await import("./portfolioValue");

		const tokens: Array<{ coinId: string; balance: string }> = [];
		const prices: CoinGeckoPriceMap = {
			ethereum: { usd: 3000 },
		};

		const result = calculateWalletTotal(tokens, prices);
		expect(result).toBe(0);
	});

	test("handles zero balances", async () => {
		const { calculateWalletTotal } = await import("./portfolioValue");

		const tokens = [
			{ coinId: "ethereum", balance: "0" },
			{ coinId: "usd-coin", balance: "0" },
		];

		const prices: CoinGeckoPriceMap = {
			ethereum: { usd: 3000 },
			"usd-coin": { usd: 1.0 },
		};

		const result = calculateWalletTotal(tokens, prices);
		expect(result).toBe(0);
	});

	test("handles multiple tokens with varying prices", async () => {
		const { calculateWalletTotal } = await import("./portfolioValue");

		const tokens = [
			{ coinId: "ethereum", balance: "2" },
			{ coinId: "tron", balance: "1000" },
			{ coinId: "usd-coin", balance: "500" },
		];

		const prices: CoinGeckoPriceMap = {
			ethereum: { usd: 3000 },
			tron: { usd: 0.12 },
			"usd-coin": { usd: 1.0 },
		};

		const result = calculateWalletTotal(tokens, prices);
		// (2 * 3000) + (1000 * 0.12) + (500 * 1) = 6000 + 120 + 500 = 6620
		expect(result).toBe(6620);
	});
});

describe("calculateGlobalTotal", () => {
	test("aggregates totals across multiple wallets", async () => {
		const { calculateGlobalTotal } = await import("./portfolioValue");

		const wallets = [
			{ tokens: [{ coinId: "ethereum", balance: "1" }] },
			{ tokens: [{ coinId: "tron", balance: "1000" }] },
		];

		const prices: CoinGeckoPriceMap = {
			ethereum: { usd: 3000 },
			tron: { usd: 0.12 },
		};

		const result = calculateGlobalTotal(wallets, prices);
		// 3000 + 120 = 3120
		expect(result).toBe(3120);
	});

	test("handles empty wallet list", async () => {
		const { calculateGlobalTotal } = await import("./portfolioValue");

		const wallets: Array<{ tokens: Array<{ coinId: string; balance: string }> }> = [];
		const prices: CoinGeckoPriceMap = {};

		const result = calculateGlobalTotal(wallets, prices);
		expect(result).toBe(0);
	});

	test("handles wallets with no tokens", async () => {
		const { calculateGlobalTotal } = await import("./portfolioValue");

		const wallets = [
			{ tokens: [] },
			{ tokens: [] },
		];

		const prices: CoinGeckoPriceMap = {};

		const result = calculateGlobalTotal(wallets, prices);
		expect(result).toBe(0);
	});

	test("mixes wallets with and without tokens", async () => {
		const { calculateGlobalTotal } = await import("./portfolioValue");

		const wallets = [
			{ tokens: [{ coinId: "ethereum", balance: "1" }] },
			{ tokens: [] },
			{ tokens: [{ coinId: "usd-coin", balance: "100" }] },
		];

		const prices: CoinGeckoPriceMap = {
			ethereum: { usd: 3000 },
			"usd-coin": { usd: 1.0 },
		};

		const result = calculateGlobalTotal(wallets, prices);
		// 3000 + 100 = 3100
		expect(result).toBe(3100);
	});
});
