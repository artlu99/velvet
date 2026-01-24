import { describe, test, expect } from "bun:test";
import {
	invalidAddressError,
	invalidChainError,
	invalidBigIntError,
	negativeBigIntError,
	apiError,
} from "./errors";

describe("errors", () => {
	describe("invalidAddressError", () => {
		test("returns balance error with correct structure", () => {
			const result = invalidAddressError("balance");
			expect(result).toEqual({
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			});
		});

		test("returns ens error with correct structure", () => {
			const result = invalidAddressError("ens");
			expect(result).toEqual({
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			});
		});

		test("returns txCount error with correct structure", () => {
			const result = invalidAddressError("txCount");
			expect(result).toEqual({
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			});
		});

		test("returns gasEstimate error with correct structure", () => {
			const result = invalidAddressError("gasEstimate");
			expect(result).toEqual({
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			});
		});
	});

	describe("invalidChainError", () => {
		test("returns balance error with supported chain message", () => {
			const result = invalidChainError("balance");
			expect(result).toEqual({
				ok: false,
				error:
					"Invalid or unsupported chain ID. Supported: 1 (mainnet), 8453 (Base)",
				code: "INVALID_CHAIN",
			});
		});

		test("returns txCount error with generic message", () => {
			const result = invalidChainError("txCount");
			expect(result).toEqual({
				ok: false,
				error: "Invalid or unsupported chain ID",
				code: "INVALID_CHAIN",
			});
		});

		test("returns gasEstimate error with generic message", () => {
			const result = invalidChainError("gasEstimate");
			expect(result).toEqual({
				ok: false,
				error: "Invalid or unsupported chain ID",
				code: "INVALID_CHAIN",
			});
		});
	});

	describe("invalidBigIntError", () => {
		test("returns error for value field", () => {
			const result = invalidBigIntError("value");
			expect(result).toEqual({
				ok: false,
				error: "Invalid value format",
				code: "NETWORK_ERROR",
			});
		});

		test("returns error for amount field", () => {
			const result = invalidBigIntError("amount");
			expect(result).toEqual({
				ok: false,
				error: "Invalid amount format",
				code: "NETWORK_ERROR",
			});
		});
	});

	describe("negativeBigIntError", () => {
		test("returns error with capitalized field name for value", () => {
			const result = negativeBigIntError("value");
			expect(result).toEqual({
				ok: false,
				error: "Value must be non-negative",
				code: "NETWORK_ERROR",
			});
		});

		test("returns error with capitalized field name for amount", () => {
			const result = negativeBigIntError("amount");
			expect(result).toEqual({
				ok: false,
				error: "Amount must be non-negative",
				code: "NETWORK_ERROR",
			});
		});
	});

	describe("apiError", () => {
		test("returns RATE_LIMITED error", () => {
			const result = apiError("Rate limit exceeded", "RATE_LIMITED");
			expect(result).toEqual({
				ok: false,
				error: "Rate limit exceeded",
				code: "RATE_LIMITED",
			});
		});

		test("returns NETWORK_ERROR error", () => {
			const result = apiError("Network request failed", "NETWORK_ERROR");
			expect(result).toEqual({
				ok: false,
				error: "Network request failed",
				code: "NETWORK_ERROR",
			});
		});

		test("returns API_ERROR error", () => {
			const result = apiError("API returned error", "API_ERROR");
			expect(result).toEqual({
				ok: false,
				error: "API returned error",
				code: "API_ERROR",
			});
		});

		test("returns BROADCAST_FAILED error", () => {
			const result = apiError("Broadcast failed", "BROADCAST_FAILED");
			expect(result).toEqual({
				ok: false,
				error: "Broadcast failed",
				code: "BROADCAST_FAILED",
			});
		});
	});
});
