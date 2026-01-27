import { describe, expect, test } from "bun:test";
import { parseBigInt, validateAddress, validateChainId } from "./validation";

describe("validation", () => {
	describe("validateAddress", () => {
		test("validates and normalizes address for balance endpoint", () => {
			const result = validateAddress(
				"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
				"balance",
			);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.address).toBe(
					"0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
				);
			}
		});

		test("validates and checksums address for ens endpoint", () => {
			const result = validateAddress(
				"0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7",
				"ens",
			);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.address).toBe(
					"0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
				);
			}
		});

		test("returns error for invalid address format", () => {
			const result = validateAddress("not-an-address", "balance");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_ADDRESS");
			}
		});

		test("returns error for empty address", () => {
			const result = validateAddress("", "balance");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_ADDRESS");
			}
		});

		test("validates for txCount endpoint", () => {
			const result = validateAddress(
				"0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
				"txCount",
			);
			expect(result.ok).toBe(true);
		});

		test("validates for gasEstimate endpoint", () => {
			const result = validateAddress(
				"0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
				"gasEstimate",
			);
			expect(result.ok).toBe(true);
		});
	});

	describe("validateChainId", () => {
		test("validates chain ID 1 (mainnet)", () => {
			const result = validateChainId("1", "balance");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.chainId).toBe(1);
			}
		});

		test("validates chain ID 8453 (Base)", () => {
			const result = validateChainId("8453", "balance");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.chainId).toBe(8453);
			}
		});

		test("returns error for undefined chainId", () => {
			const result = validateChainId(undefined, "balance");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_CHAIN");
			}
		});

		test("returns error for invalid chain ID", () => {
			const result = validateChainId("999", "balance");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_CHAIN");
			}
		});

		test("returns error for 'tron' string (not numeric)", () => {
			const result = validateChainId("tron", "balance");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_CHAIN");
			}
		});

		test("validates for txCount endpoint", () => {
			const result = validateChainId("1", "txCount");
			expect(result.ok).toBe(true);
		});

		test("validates for gasEstimate endpoint", () => {
			const result = validateChainId("8453", "gasEstimate");
			expect(result.ok).toBe(true);
		});
	});

	describe("parseBigInt", () => {
		test("parses valid positive BigInt from string", () => {
			const result = parseBigInt("123456789", "value");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(123456789n);
			}
		});

		test("parses zero", () => {
			const result = parseBigInt("0", "value");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(0n);
			}
		});

		test("parses hex string", () => {
			const result = parseBigInt("0xde0b6b3a7640000", "value");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(1000000000000000000n);
			}
		});

		test("returns error for invalid string", () => {
			const result = parseBigInt("not-a-number", "value");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NETWORK_ERROR");
				expect(result.error.error).toBe("Invalid value format");
			}
		});

		test("returns error for negative number", () => {
			const result = parseBigInt("-100", "amount");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NETWORK_ERROR");
				expect(result.error.error).toBe("Amount must be non-negative");
			}
		});

		test("parses value for amount field", () => {
			const result = parseBigInt("5000000", "amount");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(5000000n);
			}
		});
	});
});
