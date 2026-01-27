import {
	createRandomBytes,
	createSymmetricCrypto,
	type OwnerEncryptionKey,
	type SymmetricCrypto,
	utf8ToBytes,
} from "@evolu/common";
import type { KeyType } from "@shared/types";
import * as v from "valibot";
import { getAddress, isAddress } from "viem";
import { type Address, privateKeyToAccount } from "viem/accounts";
import { normalize } from "viem/ens";
import { featureFlags } from "../../shared/feature-flags";
import {
	isValidTronAddress as checkValidTronAddress,
	deriveTronAddress as deriveTronAddressFromTron,
} from "./tron";

// Re-export type-safe Tron utilities
export {
	buildAndSignTrc20Transfer,
	buildAndSignTrxTransfer,
	deriveTronAddress,
	isValidTronAddress,
} from "./tron";

/**
 * Address type discriminated union
 */
export type AddressType =
	| { type: "evm"; address: Address }
	| { type: "tron"; address: string }
	| { type: "btc"; address: string }
	| { type: "solana"; address: string }
	| { type: "unknown"; address: string };

/**
 * Type guard to check if an address is an EVM address (0x-prefixed hex)
 * @param address - The address to check
 * @returns true if the address is a valid EVM address
 */
export function isEvmAddress(address: string): address is Address {
	return isAddress(address as Address);
}

/**
 * Type guard to check if an address is a Tron address (base58check, T-address)
 * @param address - The address to check
 * @returns true if the address is a valid Tron address
 */
export function isTronAddress(address: string): boolean {
	// Tron addresses start with 'T' and are 34 characters (base58check)
	return /^T[a-zA-Z0-9]{33}$/.test(address) && checkValidTronAddress(address);
}

/**
 * Normalizes an EVM address to checksummed format for consistent storage/comparison.
 * Returns null if the address is invalid.
 * @param address - The address to normalize
 * @returns Checksummed address or null if invalid
 */
export function normalizeEvmAddress(address: string): Address | null {
	try {
		if (isEvmAddress(address)) {
			return getAddress(address);
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Discriminates an address into its blockchain type
 * @param address - The address to discriminate
 * @returns Address type object with discriminated type
 */
export function discriminateAddressType(address: string): AddressType {
	if (isEvmAddress(address)) {
		return { type: "evm", address };
	}
	if (isTronAddress(address)) {
		return { type: "tron", address };
	}
	// Bitcoin addresses (bc1, 1, 3 prefixes)
	if (
		featureFlags.BITCOIN.enabled &&
		/^(bc1|[13])[a-zA-Z0-9]{25,39}$/.test(address)
	) {
		return { type: "btc", address };
	}
	// Solana addresses (base58, 32-44 characters)
	if (
		featureFlags.SOLANA.enabled &&
		/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
	) {
		return { type: "solana", address };
	}
	return { type: "unknown", address };
}

// EVM Private Key Validation Schema
// Must be 0x-prefixed, 64 hex characters
export const EvmPrivateKeySchema = v.pipe(
	v.string(),
	v.regex(/^0x[0-9a-fA-F]{64}$/, "Invalid EVM private key format"),
	v.transform((key) => key.toLowerCase() as `0x${string}`),
);

// EVM Address Validation Schema
// Uses checksummed format (via getAddress) for consistent storage
export const EvmAddressSchema = v.pipe(
	v.string(),
	v.regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address format"),
	v.custom(
		(value: unknown) => typeof value === "string" && isAddress(value),
		"Invalid EVM address checksum",
	),
	v.transform((addr) => getAddress(addr) as Address),
);

/**
 * Validates and derives address from private key
 * @param privateKey - The private key to validate and derive from
 * @returns Object with success status and either account/address or error
 */
export function validateAndDeriveAddress(
	privateKey: string,
): { ok: true; address: Address } | { ok: false; error: string } {
	// Validate private key format
	const keyResult = v.safeParse(EvmPrivateKeySchema, privateKey);
	if (!keyResult.success) {
		return {
			ok: false,
			error:
				"Invalid private key format. Must be 0x-prefixed 64 hex characters.",
		};
	}

	try {
		const account = privateKeyToAccount(keyResult.output);
		return { ok: true, address: account.address };
	} catch {
		return { ok: false, error: "Failed to derive address from private key" };
	}
}

/**
 * Result type for unified import input validation
 */
export type ImportInputResult =
	| {
			ok: true;
			type: "privateKey";
			address: string;
			privateKey: string;
			keyType: KeyType;
	  }
	| { ok: true; type: "address"; address: string; keyType: KeyType }
	| { ok: false; error: string };

/**
 * Validates import input and auto-detects key type and format
 * Waterfall: EVM private key → EVM address → Tron address → Tron private key
 * @param input - The input string to validate (private key or address)
 * @returns Object with success status, type, address, keyType, and optional private key
 */
export function validateImportInput(input: string): ImportInputResult {
	const trimmed = input.trim();

	// 1. Try EVM private key (0x + 64 hex)
	const evmKeyResult = v.safeParse(EvmPrivateKeySchema, trimmed);
	if (evmKeyResult.success) {
		const derivationResult = validateAndDeriveAddress(evmKeyResult.output);
		if (!derivationResult.ok) {
			return { ok: false, error: derivationResult.error };
		}
		return {
			ok: true,
			type: "privateKey",
			address: derivationResult.address,
			privateKey: evmKeyResult.output,
			keyType: "evm",
		};
	}

	// 2. Try EVM address (0x + 40 hex)
	const evmAddressResult = v.safeParse(EvmAddressSchema, trimmed);
	if (evmAddressResult.success) {
		return {
			ok: true,
			type: "address",
			address: evmAddressResult.output,
			keyType: "evm",
		};
	}

	// 3. Try Tron address (base58, T-address, 34 chars)
	// Check format first
	if (/^T[a-zA-Z0-9]{33}$/.test(trimmed)) {
		// Then validate checksum
		if (isTronAddress(trimmed)) {
			return {
				ok: true,
				type: "address",
				address: trimmed,
				keyType: "tron",
			};
		}
		// Format is correct but checksum failed
		return {
			ok: false,
			error:
				"Invalid Tron address checksum. This address may have a typo. Please verify and try again.",
		};
	}

	// 4. Try Tron private key (64 hex, with or without 0x prefix)
	const tronKeyHex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
	if (/^[0-9a-fA-F]{64}$/.test(tronKeyHex)) {
		// Derive Tron address from private key
		try {
			const privateKeyHex = `0x${tronKeyHex}` as `0x${string}`;
			const address = deriveTronAddressFromTron(privateKeyHex);
			return {
				ok: true,
				type: "privateKey",
				address,
				privateKey: privateKeyHex,
				keyType: "tron",
			};
		} catch {
			// If derivation fails, continue to error
		}
	}

	return {
		ok: false,
		error:
			"Invalid input. Supported formats:\n" +
			"• EVM: 0x-prefixed private key (66 chars) or address (42 chars)\n" +
			"• Tron: 0x-prefixed private key (66 chars) or T-address (34 chars)",
	};
}

/**
 * Securely wipes sensitive data from memory
 * Note: Only works for mutable data like Uint8Array, not strings
 */
export function secureWipe(data: Uint8Array): void {
	data.fill(0);
}

// Singleton crypto instance
let cryptoInstance: SymmetricCrypto | null = null;

function getCrypto(): SymmetricCrypto {
	if (!cryptoInstance) {
		cryptoInstance = createSymmetricCrypto({
			randomBytes: createRandomBytes(),
		});
	}
	return cryptoInstance;
}

/**
 * Encrypts a private key using the owner's encryption key
 * @param privateKey - The plaintext private key (hex string with 0x prefix)
 * @param encryptionKey - The owner's encryption key from Evolu
 * @returns Base64-encoded string containing nonce (24 bytes) + ciphertext
 */
export function encryptPrivateKey(
	privateKey: string,
	encryptionKey: OwnerEncryptionKey,
): string {
	const crypto = getCrypto();

	// Convert private key string to bytes
	const plaintext = utf8ToBytes(privateKey);

	// Encrypt with XChaCha20-Poly1305
	const { nonce, ciphertext } = crypto.encrypt(plaintext, encryptionKey);

	// Combine nonce (24 bytes) + ciphertext
	const combined = new Uint8Array(nonce.length + ciphertext.length);
	combined.set(nonce, 0);
	combined.set(ciphertext, nonce.length);

	// Convert to base64 for storage
	const base64 = btoa(String.fromCharCode(...combined));

	return base64;
}

/**
 * Decrypts an encrypted private key
 * @param encrypted - Base64-encoded string containing nonce + ciphertext
 * @param encryptionKey - The owner's encryption key from Evolu
 * @returns Result object with decrypted private key or error
 */
export function decryptPrivateKey(
	encrypted: string,
	encryptionKey: OwnerEncryptionKey,
): { ok: true; value: string } | { ok: false; error: Error } {
	try {
		const crypto = getCrypto();

		// Decode base64
		const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

		// Split nonce (first 24 bytes) and ciphertext (rest)
		const NONCE_LENGTH = 24;
		if (combined.length < NONCE_LENGTH) {
			return {
				ok: false,
				error: new Error("Invalid encrypted data: too short"),
			};
		}

		const nonce = combined.slice(0, NONCE_LENGTH);
		const ciphertext = combined.slice(NONCE_LENGTH);

		// Decrypt
		const decryptResult = crypto.decrypt(ciphertext, encryptionKey, nonce);

		if (!decryptResult.ok) {
			return {
				ok: false,
				error: new Error("Decryption failed: corrupted data or wrong key"),
			};
		}

		// Convert bytes to string (private key hex)
		const privateKeyBytes = decryptResult.value;
		const privateKey = new TextDecoder().decode(privateKeyBytes);

		// Wipe the decrypted bytes from memory
		secureWipe(privateKeyBytes);

		return { ok: true, value: privateKey };
	} catch (error) {
		return {
			ok: false,
			error: new Error(
				`Invalid encrypted data: ${error instanceof Error ? error.message : "unknown error"}`,
			),
		};
	}
}

/**
 * Result type for QR-scanned data validation
 */
export type QRScannedDataResult =
	| {
			ok: true;
			type: "evm" | "ens" | "basename" | "tron";
			data: string;
	  }
	| { ok: false; error: string };

/**
 * Validates data from QR code scan.
 * Supports EVM addresses, Tron addresses, ENS names, and Basenames.
 * @param data - The scanned data string
 * @returns Object with success status, type, and data
 */
export function validateQRScannedData(data: string): QRScannedDataResult {
	const trimmed = data.trim();

	// Check if it's an EVM address
	if (isAddress(trimmed as Address)) {
		return {
			ok: true,
			type: "evm",
			data: trimmed,
		};
	}

	// Check if it's a Tron address
	if (isTronAddress(trimmed)) {
		return {
			ok: true,
			type: "tron",
			data: trimmed,
		};
	}

	// Normalize for type detection (ENSIP-15 canonical normalization)
	let normalizedForType: string;
	try {
		normalizedForType = normalize(trimmed);
	} catch {
		// If normalization fails, fall back to lowercase for basic detection
		normalizedForType = trimmed.toLowerCase();
	}

	// Check if it's a Basename (check before ENS since .base.eth also ends with .eth)
	if (
		normalizedForType.endsWith(".base.eth") &&
		normalizedForType.length > 9 &&
		normalizedForType.length < 55
	) {
		return {
			ok: true,
			type: "basename",
			data: trimmed, // Return original data, not normalized
		};
	}

	// Check if it's an ENS name (basic check: ends with .eth and reasonable length)
	if (
		normalizedForType.endsWith(".eth") &&
		normalizedForType.length > 4 &&
		normalizedForType.length < 50
	) {
		return {
			ok: true,
			type: "ens",
			data: trimmed, // Return original data, not normalized
		};
	}

	return {
		ok: false,
		error:
			"Invalid QR code format. Supported: EVM address, Tron address, ENS name, Basename.",
	};
}
