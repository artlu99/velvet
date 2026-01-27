import { describe, expect, mock, test } from "bun:test";
import type {
	BroadcastTransactionResult,
	GasEstimateResult,
	TransactionCountResult,
} from "@shared/types";

// Mock RPC layer so "happy path" tests don't hit real networks.
mock.module("./lib/rpc", () => {
	return {
		estimateGas: async () => {
			return {
				gasLimit: "21000",
				maxFeePerGas: "1000000000", // 1 gwei
				maxPriorityFeePerGas: "100000000", // 0.1 gwei
			};
		},
		estimateGasCost: (gasLimit: string, maxFeePerGas: string) => {
			return BigInt(gasLimit) * BigInt(maxFeePerGas);
		},
		broadcastTransaction: async () => {
			// tx hash shape only (not a real tx)
			return "0x000000000000000000000000000000000000000000000000000000000000abcd";
		},
		getTransactionCount: async () => 7,
	};
});

// Import after mocks are registered.
import app from "./index";

describe("Send-related API endpoints", () => {
	describe("GET /api/transaction-count/:address", () => {
		test("returns 400 for invalid address", async () => {
			const res = await app.request(
				"/api/transaction-count/not-an-address?chainId=1",
			);
			expect(res.status).toBe(400);
			const json = await res.json<TransactionCountResult>();
			expect(json.ok).toBe(false);
			if (!json.ok) expect(json.code).toBe("INVALID_ADDRESS");
		});

		test("returns 400 for missing chainId", async () => {
			const res = await app.request(
				"/api/transaction-count/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
			);
			expect(res.status).toBe(400);
			const json = await res.json<TransactionCountResult>();
			expect(json.ok).toBe(false);
			if (!json.ok) expect(json.code).toBe("INVALID_CHAIN");
		});

		test("returns 200 + nonce for valid request", async () => {
			const res = await app.request(
				"/api/transaction-count/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chainId=1",
			);
			expect(res.status).toBe(200);
			const json = await res.json<TransactionCountResult>();
			expect(json).toEqual({ ok: true, nonce: 7 });
		});
	});

	describe("POST /api/estimate-gas", () => {
		test("returns 400 for invalid from address", async () => {
			const res = await app.request("/api/estimate-gas", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: "nope",
					to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					value: "0",
					chainId: 1,
				}),
			});
			expect(res.status).toBe(400);
			const json = await res.json<GasEstimateResult>();
			expect(json.ok).toBe(false);
			if (!json.ok) expect(json.code).toBe("INVALID_ADDRESS");
		});

		test("returns 400 for invalid to address", async () => {
			const res = await app.request("/api/estimate-gas", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					to: "nope",
					value: "0",
					chainId: 1,
				}),
			});
			expect(res.status).toBe(400);
			const json = await res.json<GasEstimateResult>();
			expect(json.ok).toBe(false);
			if (!json.ok) expect(json.code).toBe("INVALID_ADDRESS");
		});

		test("returns 400 for unsupported chainId", async () => {
			const res = await app.request("/api/estimate-gas", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					value: "0",
					chainId: 137,
				}),
			});
			expect(res.status).toBe(400);
			const json = await res.json<GasEstimateResult>();
			expect(json.ok).toBe(false);
			if (!json.ok) expect(json.code).toBe("INVALID_CHAIN" as never);
		});

		test("returns 400 for invalid value format", async () => {
			const res = await app.request("/api/estimate-gas", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					value: "not-a-number",
					chainId: 1,
				}),
			});
			expect(res.status).toBe(400);
			const json = await res.json<GasEstimateResult>();
			expect(json.ok).toBe(false);
			if (!json.ok) expect(json.code).toBe("NETWORK_ERROR");
		});

		test("returns 400 for negative value", async () => {
			const res = await app.request("/api/estimate-gas", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					value: "-1",
					chainId: 1,
				}),
			});
			expect(res.status).toBe(400);
			const json = await res.json<GasEstimateResult>();
			expect(json.ok).toBe(false);
			if (!json.ok) expect(json.code).toBe("NETWORK_ERROR");
		});

		test("returns 200 + fee fields for valid request", async () => {
			const res = await app.request("/api/estimate-gas", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					value: "0",
					chainId: 1,
				}),
			});

			expect(res.status).toBe(200);
			const json = await res.json<GasEstimateResult>();
			expect(json.ok).toBe(true);
			if (json.ok) {
				expect(json.gasLimit).toBe("21000");
				expect(json.maxFeePerGas).toBe("1000000000");
				expect(json.maxPriorityFeePerGas).toBe("100000000");
				// totalCostEth is derived from estimateGasCost + formatEther; verify it exists and is numeric-ish.
				expect(typeof json.totalCostEth).toBe("string");
				expect(json.totalCostEth.length).toBeGreaterThan(0);
			}
		});
	});

	describe("POST /api/broadcast-transaction", () => {
		test("returns 400 for invalid signed transaction format", async () => {
			const res = await app.request("/api/broadcast-transaction", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					signedTransaction: "nope",
					chainId: 1,
				}),
			});
			expect(res.status).toBe(400);
			const json = await res.json<BroadcastTransactionResult>();
			expect(json.ok).toBe(false);
			if (!json.ok) expect(json.code).toBe("INVALID_TRANSACTION");
		});

		test("returns 400 for unsupported chainId", async () => {
			const res = await app.request("/api/broadcast-transaction", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					signedTransaction: "0x1234567890",
					chainId: 137,
				}),
			});
			expect(res.status).toBe(400);
			const json = await res.json<BroadcastTransactionResult>();
			expect(json.ok).toBe(false);
			if (!json.ok) expect(json.code).toBe("INVALID_CHAIN" as any);
		});

		test("returns 200 + txHash for valid request", async () => {
			const res = await app.request("/api/broadcast-transaction", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					signedTransaction: "0x1234567890",
					chainId: 1,
				}),
			});
			expect(res.status).toBe(200);
			const json = await res.json<BroadcastTransactionResult>();
			expect(json.ok).toBe(true);
			if (json.ok) {
				expect(json.txHash).toMatch(/^0x[0-9a-fA-F]+$/);
				expect(json.txHash.length).toBe(66);
			}
		});
	});
});
