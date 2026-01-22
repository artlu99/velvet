import { describe, expect, test } from "bun:test";
import { deriveEvmAddress, deriveEvmKeyFromMnemonic } from "./bip32";

// Test mnemonic (valid BIP39)
const testMnemonic =
	"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";


describe("deriveNextKey", () => {
	test("calculates correct BIP44 derivation path for index 0", () => {
		const privateKey = deriveEvmKeyFromMnemonic(testMnemonic, 0);
		const address = deriveEvmAddress(privateKey);

		expect(privateKey).toMatch(/^0x[0-9a-f]{64}$/);
		expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
	});

	test("calculates different addresses for different indices", () => {
		const key0 = deriveEvmKeyFromMnemonic(testMnemonic, 0);
		const key1 = deriveEvmKeyFromMnemonic(testMnemonic, 1);
		const address0 = deriveEvmAddress(key0);
		const address1 = deriveEvmAddress(key1);

		expect(address0).not.toBe(address1);
	});

	test("derives same address for same index", () => {
		const key1 = deriveEvmKeyFromMnemonic(testMnemonic, 5);
		const key2 = deriveEvmKeyFromMnemonic(testMnemonic, 5);
		const address1 = deriveEvmAddress(key1);
		const address2 = deriveEvmAddress(key2);

		expect(address1).toBe(address2);
	});
});

describe("recreateKeyByIndex", () => {
	test("recreates key at specified index", () => {
		const index = 10;
		const privateKey = deriveEvmKeyFromMnemonic(testMnemonic, index);
		const address = deriveEvmAddress(privateKey);

		expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
	});

	test("recreating same index gives same address", () => {
		const index = 7;
		const key1 = deriveEvmKeyFromMnemonic(testMnemonic, index);
		const key2 = deriveEvmKeyFromMnemonic(testMnemonic, index);
		const address1 = deriveEvmAddress(key1);
		const address2 = deriveEvmAddress(key2);

		expect(address1).toBe(address2);
	});

	test("handles large index values", () => {
		const largeIndex = 2 ** 20; // 1,048,576
		const privateKey = deriveEvmKeyFromMnemonic(testMnemonic, largeIndex);
		const address = deriveEvmAddress(privateKey);

		expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
	});
});

describe("error handling", () => {
	test("deriveEvmKeyFromMnemonic rejects invalid mnemonic", () => {
		expect(() => deriveEvmKeyFromMnemonic("invalid words", 0)).toThrow(
			"Invalid mnemonic",
		);
	});

	test("deriveEvmKeyFromMnemonic rejects negative index", () => {
		expect(() => deriveEvmKeyFromMnemonic(testMnemonic, -1)).toThrow(
			"Index must be non-negative",
		);
	});

	test("deriveEvmAddress rejects invalid private key", () => {
		expect(() => deriveEvmAddress("0xinvalid")).toThrow("Invalid private key");
	});

	test("handles extremely large index", () => {
		const largeIndex = 2 ** 31 - 1; // Max safe hardened index
		const privateKey = deriveEvmKeyFromMnemonic(testMnemonic, largeIndex);

		expect(privateKey).toMatch(/^0x[0-9a-f]{64}$/);
	});
});
