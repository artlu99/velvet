import { describe, expect, test } from "bun:test";
import { deriveEvmAddress, deriveEvmKeyFromMnemonic } from "./bip32";

describe("deriveEvmKeyFromMnemonic", () => {
	// Valid BIP39 test mnemonic (12 words)
	const validMnemonic =
		"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

	test("derives key at index 0 with correct BIP44 path", () => {
		const mnemonic = validMnemonic;
		const index = 0;
		const privateKey = deriveEvmKeyFromMnemonic(mnemonic, index);

		// Expected: 0x... (64 hex chars)
		expect(privateKey).toMatch(/^0x[0-9a-f]{64}$/);
	});

	test("derives different keys for different indices", () => {
		const key0 = deriveEvmKeyFromMnemonic(validMnemonic, 0);
		const key1 = deriveEvmKeyFromMnemonic(validMnemonic, 1);

		expect(key0).not.toBe(key1);
	});

	test("derives same key for same mnemonic and index", () => {
		const key1 = deriveEvmKeyFromMnemonic(validMnemonic, 0);
		const key2 = deriveEvmKeyFromMnemonic(validMnemonic, 0);

		expect(key1).toBe(key2);
	});

	test("throws on invalid mnemonic", () => {
		expect(() => deriveEvmKeyFromMnemonic("invalid words", 0)).toThrow(
			"Invalid mnemonic",
		);
	});

	test("throws on negative index", () => {
		expect(() => deriveEvmKeyFromMnemonic(validMnemonic, -1)).toThrow(
			"Index must be non-negative",
		);
	});
});

describe("deriveEvmAddress", () => {
	test("derives valid EVM address from private key", () => {
		const privateKey =
			"0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
		const address = deriveEvmAddress(privateKey);

		// Known address for this private key
		expect(address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
	});

	test("derives checksum address", () => {
		const privateKey =
			"0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
		const address = deriveEvmAddress(privateKey);

		expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
		expect(address).not.toBe(address.toLowerCase());
	});

	test("throws on invalid private key", () => {
		expect(() => deriveEvmAddress("0xinvalid")).toThrow(
			"Invalid private key",
		);
	});
});
