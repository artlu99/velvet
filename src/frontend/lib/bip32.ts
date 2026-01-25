import type { Evolu, OwnerEncryptionKey } from "@evolu/common";
import { HDKey } from "@scure/bip32";
import * as bip39 from "@scure/bip39";
import { mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { type Address, privateKeyToAccount } from "viem/accounts";
import { featureFlags } from "../../shared/feature-flags";
import {
	deriveTronAddress as deriveTronAddressFromCrypto,
	encryptPrivateKey,
} from "./crypto";
import {
	insertDerivedKeyIfNew,
	updateDerivationCounter,
} from "./queries/derivation";
import type { KeyType } from "./schema";

const MAX_DERIVATION_INDEX = 2 ** 31 - 1; // BIP32 hardened limit

/**
 * Derives an EVM private key from mnemonic using BIP44 path m/44'/60'/0'/0/{index}
 * @param mnemonic - BIP39 mnemonic phrase (12-24 words)
 * @param index - Derivation index (>= 0)
 * @returns Private key as hex string (0x...)
 * @throws Error if mnemonic invalid or index negative
 */
export function deriveEvmKeyFromMnemonic(
	mnemonic: string,
	index: number,
	passphrase?: string,
): `0x${string}` {
	// Validate index
	if (index < 0) {
		throw new Error("Index must be non-negative");
	}
	if (index > MAX_DERIVATION_INDEX) {
		throw new Error(`Index must be less than ${MAX_DERIVATION_INDEX}`);
	}

	// Validate mnemonic
	if (!bip39.validateMnemonic(mnemonic, wordlist)) {
		throw new Error("Invalid mnemonic");
	}

	// Generate seed from mnemonic
	const seed = mnemonicToSeedSync(mnemonic, passphrase ?? "");

	// Create HD key from seed
	const hdKey = HDKey.fromMasterSeed(seed);

	// Derive using BIP44 path: m/44'/60'/0'/0/{index}
	// 44' = BIP44 purpose
	// 60' = Ethereum coin type
	// 0' = account
	// 0 = change (external)
	// {index} = address index
	const path = `m/44'/60'/0'/0/${index}`;
	const derivedKey = hdKey.derive(path);

	if (!derivedKey.privateKey) {
		throw new Error("Failed to derive private key");
	}

	// Convert Uint8Array to hex string with 0x prefix
	const hex = Array.from(derivedKey.privateKey)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	const privateKey = `0x${hex}`;

	return privateKey as `0x${string}`;
}

/**
 * Derives EVM address from private key
 * @param privateKey - Private key as hex string
 * @returns Checksummed EVM address
 * @throws Error if private key invalid
 */
export function deriveEvmAddress(privateKey: `0x${string}`): Address {
	// Validate private key format
	if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
		throw new Error("Invalid private key");
	}

	try {
		const account = privateKeyToAccount(privateKey);
		return account.address;
	} catch {
		throw new Error("Invalid private key");
	}
}

/**
 * Derives a Tron private key from mnemonic using BIP44 path m/44'/195'/0'/0/{index}
 * @param mnemonic - BIP39 mnemonic phrase (12-24 words)
 * @param index - Derivation index (>= 0)
 * @returns Private key as hex string (0x...)
 * @throws Error if mnemonic invalid or index negative
 */
export function deriveTronKeyFromMnemonic(
	mnemonic: string,
	index: number,
): `0x${string}` {
	if (index < 0) {
		throw new Error("Index must be non-negative");
	}

	if (!bip39.validateMnemonic(mnemonic, wordlist)) {
		throw new Error("Invalid mnemonic");
	}

	const seed = mnemonicToSeedSync(mnemonic, "");
	const hdKey = HDKey.fromMasterSeed(seed);

	const path = `m/44'/195'/0'/0/${index}`;
	const derivedKey = hdKey.derive(path);

	if (!derivedKey.privateKey) {
		throw new Error("Failed to derive private key");
	}

	const hex = Array.from(derivedKey.privateKey)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	const privateKey = `0x${hex}`;

	return privateKey as `0x${string}`;
}

// Re-export type-safe Tron address derivation
export const deriveTronAddress = deriveTronAddressFromCrypto;

/**
 * Derives a key at the specified index and stores it in the database.
 * Idempotent: if key already exists at this index, returns success with alreadyExists=true.
 *
 * This is the unified function for all key derivation. Use it to:
 * - Derive the next sequential key (calculate index from existing data first)
 * - Recreate a key at a specific index (for recovery or manual derivation)
 *
 * @param evolu - Evolu instance
 * @param mnemonic - BIP39 mnemonic from owner
 * @param encryptionKey - Owner's encryption key
 * @param index - Index to derive (>= 0)
 * @param keyType - Type of key to derive ("evm" | "tron" | "btc" | "solana")
 * @returns Result with success status, index, address, and alreadyExists flag
 */
export async function deriveKeyAt(
	evolu: Evolu,
	mnemonic: string,
	encryptionKey: OwnerEncryptionKey,
	index: number,
	keyType: KeyType = "evm",
): Promise<
	| { success: true; index: number; address: string; alreadyExists: boolean }
	| { success: false; error: string }
> {
	try {
		// Validate index
		if (index < 0) {
			return { success: false, error: "Index must be non-negative" };
		}

		// Validate mnemonic
		if (!mnemonic) {
			return { success: false, error: "Mnemonic required" };
		}

		let privateKey: `0x${string}`;
		let address: string;

		// Derive based on keyType
		switch (keyType) {
			case "evm":
				privateKey = deriveEvmKeyFromMnemonic(mnemonic, index);
				address = deriveEvmAddress(privateKey);
				break;
			case "tron":
				privateKey = deriveTronKeyFromMnemonic(mnemonic, index);
				address = deriveTronAddress(privateKey);
				break;
			case "btc":
				if (!featureFlags.BITCOIN.enabled) {
					return {
						success: false,
						error: "Bitcoin support is disabled",
					};
				}
				return {
					success: false,
					error: "Bitcoin derivation not yet implemented",
				};
			case "solana":
				if (!featureFlags.SOLANA.enabled) {
					return {
						success: false,
						error: "Solana support is disabled",
					};
				}
				return {
					success: false,
					error: "Solana derivation not yet implemented",
				};
			default:
				return {
					success: false,
					error: `Unknown key type: ${keyType}`,
				};
		}

		// Encrypt private key
		const encryptedPrivateKey = encryptPrivateKey(privateKey, encryptionKey);

		// Insert into database (will check for duplicate)
		const result = await insertDerivedKeyIfNew(
			evolu,
			{
				index,
				address,
				encryptedPrivateKey,
			},
			keyType,
		);

		if (!result.eoaId) {
			return { success: false, error: "Failed to store derived key" };
		}

		// Update counter only if we actually inserted a new key
		if (result.inserted) {
			await updateDerivationCounter(evolu, keyType, index);
		}

		return {
			success: true,
			index,
			address,
			alreadyExists: !result.inserted,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
