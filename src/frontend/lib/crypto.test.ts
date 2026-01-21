import { describe, expect, test } from "bun:test";
import {
	validateAndDeriveAddress,
	EvmPrivateKeySchema,
	EvmAddressSchema,
	secureWipe,
} from "./crypto";
import * as v from "valibot";

describe("Crypto Utilities", () => {
	describe("EvmPrivateKeySchema", () => {
		test("should validate correct private key", () => {
			const validKey =
				"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
			const result = v.safeParse(EvmPrivateKeySchema, validKey);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.output).toBe(validKey);
			}
		});

		test("should reject missing 0x prefix", () => {
			const invalidKey =
				"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
			const result = v.safeParse(EvmPrivateKeySchema, invalidKey);
			expect(result.success).toBe(false);
		});

		test("should reject wrong length (too short)", () => {
			const shortKey = "0x1234567890abcdef";
			const result = v.safeParse(EvmPrivateKeySchema, shortKey);
			expect(result.success).toBe(false);
		});

		test("should reject wrong length (too long)", () => {
			const longKey =
				"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00";
			const result = v.safeParse(EvmPrivateKeySchema, longKey);
			expect(result.success).toBe(false);
		});

		test("should reject non-hex characters", () => {
			const invalidKey =
				"0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG";
			const result = v.safeParse(EvmPrivateKeySchema, invalidKey);
			expect(result.success).toBe(false);
		});

		test("should convert uppercase to lowercase", () => {
			const upperKey =
				"0xABCD1234567890ABCD1234567890ABCD1234567890ABCD1234567890ABCD1234";
			const result = v.safeParse(EvmPrivateKeySchema, upperKey);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.output).toBe(upperKey.toLowerCase() as `0x${string}`);
			}
		});

		test("should reject key with only 0x prefix", () => {
			const onlyPrefix = "0x";
			const result = v.safeParse(EvmPrivateKeySchema, onlyPrefix);
			expect(result.success).toBe(false);
		});

		test("should reject key with leading/trailing whitespace", () => {
			const keyWithWhitespace =
				"  0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef  ";
			const result = v.safeParse(EvmPrivateKeySchema, keyWithWhitespace);
			expect(result.success).toBe(false);
		});
	});

	describe("validateAndDeriveAddress", () => {
		test("should derive correct address from private key (known test vector)", () => {
			// Known test vector: private key 0x1 -> address
			const privateKey =
				"0x0000000000000000000000000000000000000000000000000000000000000001";
			const result = validateAndDeriveAddress(privateKey);

			expect(result.ok).toBe(true);
			if (result.ok) {
				// viem returns checksummed address (mixed case)
				expect(result.address).toBe(
					"0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf"
				);
			}
		});

		test("should return error for invalid private key format", () => {
			const invalidKey = "0xinvalid";
			const result = validateAndDeriveAddress(invalidKey);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("Invalid private key format");
			}
		});

		test("should return error for private key without 0x prefix", () => {
			const invalidKey =
				"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
			const result = validateAndDeriveAddress(invalidKey);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("Invalid private key format");
			}
		});

		test("should return error for empty string", () => {
			const emptyKey = "";
			const result = validateAndDeriveAddress(emptyKey);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("Invalid private key format");
			}
		});

		test("should return error for key with leading/trailing whitespace", () => {
			const keyWithWhitespace =
				"  0x0000000000000000000000000000000000000000000000000000000000000001  ";
			const result = validateAndDeriveAddress(keyWithWhitespace);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("Invalid private key format");
			}
		});
	});

	describe("EvmAddressSchema", () => {
		test("should validate correct address", () => {
			const validAddress = "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf";
			const result = v.safeParse(EvmAddressSchema, validAddress);
			expect(result.success).toBe(true);
		});

		test("should reject invalid checksum", () => {
			const invalidAddress = "0x7E5F4552091A69125D5DFCB7B8C2659029395BDF"; // all uppercase
			const result = v.safeParse(EvmAddressSchema, invalidAddress);
			expect(result.success).toBe(false);
		});

		test("should reject wrong length", () => {
			const shortAddress = "0x7e5f4552";
			const result = v.safeParse(EvmAddressSchema, shortAddress);
			expect(result.success).toBe(false);
		});

		test("should reject non-hex characters", () => {
			const invalidAddress = "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG";
			const result = v.safeParse(EvmAddressSchema, invalidAddress);
			expect(result.success).toBe(false);
		});
	});

	describe("secureWipe", () => {
		test("should zero out Uint8Array", () => {
			const data = new Uint8Array([1, 2, 3, 4, 5]);
			secureWipe(data);
			expect(Array.from(data)).toEqual([0, 0, 0, 0, 0]);
		});

		test("should handle empty array", () => {
			const data = new Uint8Array([]);
			secureWipe(data);
			expect(Array.from(data)).toEqual([]);
			expect(data.length).toBe(0);
		});

		test("should handle array with single byte", () => {
			const data = new Uint8Array([255]);
			secureWipe(data);
			expect(Array.from(data)).toEqual([0]);
			expect(data.length).toBe(1);
		});
	});
});
