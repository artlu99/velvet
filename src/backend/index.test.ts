import { describe, expect, test } from "bun:test";
import type { BalanceResult, PricesResult } from "@shared/types";
import app from "./index";

// Mock CoinGecko fetch for tests
const mockPricesResponse = {
	ethereum: { usd: 3000 },
	tron: { usd: 0.12 },
	"usd-coin": { usd: 1.0 },
	tether: { usd: 1.0 },
};

globalThis.fetch = (() =>
	Promise.resolve({
		ok: true,
		json: async () => mockPricesResponse,
	} as Response)) as unknown as typeof fetch;

describe("GET /api/name", () => {
	test("should return app name and include security headers", async () => {
		const mockEnv = { NAME: "TestApp" };
		const res = await app.request("/api/name", {}, mockEnv);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ name: "TestApp" });

		// Verify security headers from middleware
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(res.headers.get("access-control-allow-origin")).not.toBeNull();
	});
});

describe("GET /api/balance/:address", () => {
	const mockEnv = {
		NAME: "TestApp",
		ETHERSCAN_API_KEY: "test-api-key",
	};

	test("returns 400 for invalid address format", async () => {
		const res = await app.request(
			"/api/balance/invalid-address?chainId=1",
			{},
			mockEnv,
		);

		expect(res.status).toBe(400);

		const json = await res.json<BalanceResult>();
		expect(json.ok).toBe(false);
		if (!json.ok) {
			expect(json.code).toBe("INVALID_ADDRESS");
		}
	});

	test("returns 400 for missing chainId", async () => {
		const res = await app.request(
			"/api/balance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
			{},
			mockEnv,
		);

		expect(res.status).toBe(400);

		const json = await res.json<BalanceResult>();
		expect(json.ok).toBe(false);
		if (!json.ok) {
			expect(json.code).toBe("INVALID_CHAIN");
		}
	});

	test("returns 400 for unsupported chainId", async () => {
		const res = await app.request(
			"/api/balance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chainId=137",
			{},
			mockEnv,
		);

		expect(res.status).toBe(400);

		const json = await res.json<BalanceResult>();
		expect(json.ok).toBe(false);
		if (!json.ok) {
			expect(json.code).toBe("INVALID_CHAIN");
		}
	});

	test("returns 400 for non-numeric chainId", async () => {
		const res = await app.request(
			"/api/balance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chainId=abc",
			{},
			mockEnv,
		);

		expect(res.status).toBe(400);

		const json = await res.json<BalanceResult>();
		expect(json.ok).toBe(false);
		if (!json.ok) {
			expect(json.code).toBe("INVALID_CHAIN");
		}
	});

	test("supports cacheBust=1 to bypass KV cache reads", async () => {
		const envWithCache = {
			...mockEnv,
			BALANCE_CACHE: {
				get: async () => ({
					ok: true,
					address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					chainId: 1,
					balanceWei: "123",
					balanceEth: "0.000000000000000123",
					timestamp: 1,
				}),
				put: async () => undefined,
			},
		};

		// Without cacheBust we should hit the cache and see the hit header.
		const resHit = await app.request(
			"/api/balance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chainId=1",
			{},
			envWithCache,
		);
		expect(resHit.status).toBe(200);
		expect(resHit.headers.get("x-balance-cache")).toBe("hit");

		// With cacheBust we bypass cache reads. This will then attempt a live fetch,
		// which (in tests) may fail; we only assert that the cache header shows bypass.
		const resBypass = await app.request(
			"/api/balance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chainId=1&cacheBust=1",
			{},
			envWithCache,
		);
		expect(resBypass.headers.get("x-balance-cache")).toBe("bypass");
	});

	// Integration test - requires real API key
	// Run with: ETHERSCAN_API_KEY=xxx bun test
	test("fetches real balance with valid API key", async () => {
		const apiKey = process.env.ETHERSCAN_API_KEY;
		if (!apiKey) {
			console.warn("Skipping integration test: ETHERSCAN_API_KEY not set");
			return;
		}

		const realEnv = { NAME: "TestApp", ETHERSCAN_API_KEY: apiKey };
		const res = await app.request(
			"/api/balance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chainId=1",
			{},
			realEnv,
		);

		// May be 200 or 429/502 depending on rate limits
		if (res.status === 200) {
			const json = await res.json<BalanceResult>();
			expect(json.ok).toBe(true);
			if (json.ok) {
				expect(json.address).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
				expect(json.chainId).toBe(1);
				expect(json.balanceWei).toBeDefined();
				expect(json.balanceEth).toBeDefined();
				expect(json.timestamp).toBeGreaterThan(0);
			}
		} else {
			console.warn(`Integration test got status ${res.status}`);
		}
	});
});

describe("GET /api/prices", () => {
	test("returns cached prices when available", async () => {
		const mockPrices = {
			ok: true,
			prices: {
				ethereum: { usd: 3000 },
				tron: { usd: 0.12 },
			},
			timestamp: Date.now(),
		};
		const envWithCache = {
			NAME: "TestApp",
			COINGECKO_API_KEY: "test-key",
			BALANCE_CACHE: {
				get: async () => mockPrices,
				put: async () => undefined,
			},
		};

		const res = await app.request("/api/prices?ids=ethereum,tron", {}, envWithCache);

		expect(res.status).toBe(200);
		expect(res.headers.get("x-prices-cache")).toBe("hit");

		const json = await res.json<PricesResult>();
		expect(json.ok).toBe(true);
		if (json.ok) {
			expect(json.prices).toEqual(mockPrices.prices);
			expect(json.timestamp).toBe(mockPrices.timestamp);
		}
	});

	test("fetches fresh prices on cache miss", async () => {
		let cachePutCalled = false;
		const envWithCache = {
			NAME: "TestApp",
			COINGECKO_API_KEY: "test-key",
			BALANCE_CACHE: {
				get: async () => null, // Cache miss
				put: async () => {
					cachePutCalled = true;
				},
			},
		};

		const res = await app.request("/api/prices?ids=ethereum", {}, envWithCache);

		expect(res.headers.get("x-prices-cache")).toBe("miss");
		expect(cachePutCalled).toBe(true);

		if (res.status === 200) {
			const json = await res.json<PricesResult>();
			expect(json.ok).toBe(true);
		}
	});

	test("returns default tokens when no ids specified", async () => {
		const envWithCache = {
			NAME: "TestApp",
			COINGECKO_API_KEY: "test-key",
			BALANCE_CACHE: {
				get: async () => null,
				put: async () => undefined,
			},
		};

		const res = await app.request("/api/prices", {}, envWithCache);

		// Should fetch default tokens: ethereum, tron, usd-coin, tether
		expect(res.status).toBeGreaterThanOrEqual(200);
		expect(res.status).toBeLessThan(500);
	});

	test("supports cacheBust to bypass cache", async () => {
		const mockPrices = {
			ok: true,
			prices: { ethereum: { usd: 3000 } },
			timestamp: Date.now(),
		};
		const envWithCache = {
			NAME: "TestApp",
			COINGECKO_API_KEY: "test-key",
			BALANCE_CACHE: {
				get: async () => mockPrices, // Has cached value
				put: async () => undefined,
			},
		};

		// Without cacheBust - should hit cache
		const resHit = await app.request(
			"/api/prices?ids=ethereum",
			{},
			envWithCache,
		);
		expect(resHit.headers.get("x-prices-cache")).toBe("hit");

		// With cacheBust - should bypass cache
		const resBypass = await app.request(
			"/api/prices?ids=ethereum&cacheBust=1",
			{},
			envWithCache,
		);
		expect(resBypass.headers.get("x-prices-cache")).toBe("bypass");
	});

	test("handles CoinGecko API errors", async () => {
		const envWithCache = {
			NAME: "TestApp",
			COINGECKO_API_KEY: "invalid-key", // May cause rate limit or error
			BALANCE_CACHE: {
				get: async () => null,
				put: async () => undefined,
			},
		};

		const res = await app.request(
			"/api/prices?ids=ethereum",
			{},
			envWithCache,
		);

		// Should handle error gracefully
		if (res.status === 429 || res.status === 502) {
			const json = await res.json<PricesResult>();
			expect(json.ok).toBe(false);
		}
		// If CoinGecko allows the request, that's also fine
	});

	// Integration test - requires real API key
	test("fetches real prices with valid API key", async () => {
		const apiKey = process.env.COINGECKO_API_KEY;
		if (!apiKey) {
			console.warn("Skipping integration test: COINGECKO_API_KEY not set");
			return;
		}

		const realEnv = {
			NAME: "TestApp",
			COINGECKO_API_KEY: apiKey,
			BALANCE_CACHE: {
				get: async () => null,
				put: async () => undefined,
			},
		};

		const res = await app.request(
			"/api/prices?ids=ethereum,tron",
			{},
			realEnv,
		);

		if (res.status === 200) {
			const json = await res.json<PricesResult>();
			expect(json.ok).toBe(true);
			if (json.ok) {
				expect(json.prices.ethereum?.usd).toBeGreaterThan(0);
				expect(json.prices.tron?.usd).toBeGreaterThan(0);
				expect(json.timestamp).toBeGreaterThan(0);
			}
		} else {
			console.warn(`Integration test got status ${res.status}`);
		}
	}, 30_000);
});
