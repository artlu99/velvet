import { describe, expect, test } from "bun:test";
import type { BalanceResult } from "@shared/types";
import app from "./index";

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
