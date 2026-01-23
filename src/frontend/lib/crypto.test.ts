import { describe, expect, test } from "bun:test";
import {
	validateAndDeriveAddress,
	EvmPrivateKeySchema,
	EvmAddressSchema,
	secureWipe,
	validateImportInput,
	encryptPrivateKey,
	decryptPrivateKey,
} from "./crypto";
import * as v from "valibot";
import type { OwnerEncryptionKey } from "@evolu/common";

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

	describe("validateImportInput", () => {
		test("should accept valid private key and derive address", () => {
			const privateKey =
				"0x0000000000000000000000000000000000000000000000000000000000000001";
			const result = validateImportInput(privateKey);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.type).toBe("privateKey");
				if (result.type === "privateKey") {
					expect(result.privateKey).toBe(privateKey);
				}
				expect(result.address).toBe(
					"0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
				);
				expect(result.keyType).toBe("evm");
			}
		});

		test("should accept valid address as watch-only", () => {
			const address = "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf";
			const result = validateImportInput(address);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.type).toBe("address");
				expect(result.address).toBe(address);
				expect(result.keyType).toBe("evm");
			}
		});

		test("should reject invalid hex string", () => {
			const result = validateImportInput(
				"0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
			);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("Invalid input");
			}
		});

		test("should reject wrong length (neither address nor key)", () => {
			const result = validateImportInput(
				"0x1234567890abcdef1234567890abcdef123456789012",
			);
			expect(result.ok).toBe(false);
		});

		test("should trim whitespace", () => {
			const address = "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf";
			const result = validateImportInput(`  ${address}  `);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.address).toBe(address);
			}
		});

		test("should reject empty string", () => {
			const result = validateImportInput("");
			expect(result.ok).toBe(false);
		});

		test("should reject missing 0x prefix", () => {
			const result = validateImportInput(
				"7e5f4552091a69125d5dfcb7b8c2659029395bdf",
			);
			expect(result.ok).toBe(false);
		});

		test("should handle uppercase address (checksum validation)", () => {
			const result = validateImportInput(
				"0x7E5F4552091A69125D5DFCB7B8C2659029395BDF",
			);
			expect(result.ok).toBe(false); // checksum validation fails for all uppercase
		});

		test("should reject string with only whitespace", () => {
			const result = validateImportInput("   ");
			expect(result.ok).toBe(false);
		});
	});

	describe("encryptPrivateKey", () => {
		test("should encrypt private key to base64 string", () => {
			const privateKey =
				"0x0000000000000000000000000000000000000000000000000000000000000001";

			// Create a mock OwnerEncryptionKey (32 bytes)
			const mockKey = new Uint8Array(32) as OwnerEncryptionKey;
			mockKey.fill(42); // Fill with test data

			const result = encryptPrivateKey(privateKey, mockKey);

			// Result should be a base64 string
			expect(typeof result).toBe("string");
			// Base64 strings use specific characters
			expect(result).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
			// Should be non-empty
			expect(result.length).toBeGreaterThan(0);
		});

		test("should produce different output for same input (random nonce)", () => {
			const privateKey =
				"0x0000000000000000000000000000000000000000000000000000000000000001";

			const mockKey = new Uint8Array(32) as OwnerEncryptionKey;
			mockKey.fill(42);

			const result1 = encryptPrivateKey(privateKey, mockKey);
			const result2 = encryptPrivateKey(privateKey, mockKey);

			// Due to random nonce, encrypted values should differ
			expect(result1).not.toBe(result2);
		});

		test("should handle different private keys", () => {
			const key1 =
				"0x0000000000000000000000000000000000000000000000000000000000000001";
			const key2 =
				"0x0000000000000000000000000000000000000000000000000000000000000002";

			const mockKey = new Uint8Array(32) as OwnerEncryptionKey;
			mockKey.fill(42);

			const result1 = encryptPrivateKey(key1, mockKey);
			const result2 = encryptPrivateKey(key2, mockKey);

			// Different keys should produce different encrypted output
			expect(result1).not.toBe(result2);
		});
	});

	describe("decryptPrivateKey", () => {
		test("should decrypt successfully with valid encrypted data", () => {
			const privateKey =
				"0x0000000000000000000000000000000000000000000000000000000000000001";

			const mockKey = new Uint8Array(32) as OwnerEncryptionKey;
			mockKey.fill(42);

			// First encrypt
			const encrypted = encryptPrivateKey(privateKey, mockKey);

			// Then decrypt
			const result = decryptPrivateKey(encrypted, mockKey);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(privateKey);
			}
		});

		test("should return error for invalid base64", () => {
			const mockKey = new Uint8Array(32) as OwnerEncryptionKey;
			mockKey.fill(42);

			const result = decryptPrivateKey("not-valid-base64!!!", mockKey);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBeInstanceOf(Error);
				expect(result.error.message).toContain("Invalid encrypted data");
			}
		});

		test("should return error for corrupted data", () => {
			const mockKey = new Uint8Array(32) as OwnerEncryptionKey;
			mockKey.fill(42);

			// Valid base64 but not valid encrypted data
			const fakeEncrypted = btoa("corrupted data");

			const result = decryptPrivateKey(fakeEncrypted, mockKey);

			expect(result.ok).toBe(false);
		});

		test("should return error for empty string", () => {
			const mockKey = new Uint8Array(32) as OwnerEncryptionKey;
			mockKey.fill(42);

			const result = decryptPrivateKey("", mockKey);

			expect(result.ok).toBe(false);
		});

		test("should handle wrong encryption key", () => {
			const privateKey =
				"0x0000000000000000000000000000000000000000000000000000000000000001";

			const key1 = new Uint8Array(32) as OwnerEncryptionKey;
			key1.fill(42);
			const key2 = new Uint8Array(32) as OwnerEncryptionKey;
			key2.fill(99); // Different key

			const encrypted = encryptPrivateKey(privateKey, key1);
			const result = decryptPrivateKey(encrypted, key2);

			// Decryption with wrong key should fail
			expect(result.ok).toBe(false);
		});

		test("should roundtrip encrypt/decrypt correctly", () => {
			const testKeys = [
				"0x0000000000000000000000000000000000000000000000000000000000000001",
				"0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
				"0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
			];

			const mockKey = new Uint8Array(32) as OwnerEncryptionKey;
			mockKey.fill(42);

			for (const originalKey of testKeys) {
				const encrypted = encryptPrivateKey(originalKey, mockKey);
				const decrypted = decryptPrivateKey(encrypted, mockKey);

				expect(decrypted.ok).toBe(true);
				if (decrypted.ok) {
					expect(decrypted.value).toBe(originalKey);
				}
			}
		});
	});
});
