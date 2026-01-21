import * as v from "valibot";
import { isAddress } from "viem";
import { type Address, privateKeyToAccount } from "viem/accounts";

// EVM Private Key Validation Schema
// Must be 0x-prefixed, 64 hex characters
export const EvmPrivateKeySchema = v.pipe(
	v.string(),
	v.regex(/^0x[0-9a-fA-F]{64}$/, "Invalid EVM private key format"),
	v.transform((key) => key.toLowerCase() as `0x${string}`),
);

// EVM Address Validation Schema
export const EvmAddressSchema = v.pipe(
	v.string(),
	v.regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address format"),
	v.custom(
		(value: unknown) => typeof value === "string" && isAddress(value),
		"Invalid EVM address checksum",
	),
	v.transform((addr) => addr.toLowerCase() as Address),
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
	| { ok: true; type: "privateKey"; address: Address; privateKey: string }
	| { ok: true; type: "address"; address: Address; privateKey: null }
	| { ok: false; error: string };

/**
 * Validates import input and auto-detects whether it's a private key or address
 * @param input - The input string to validate (private key or address)
 * @returns Object with success status, type, address, and optional private key
 */
export function validateImportInput(input: string): ImportInputResult {
	const trimmed = input.trim();

	// Try private key first (66 chars: 0x + 64 hex)
	const keyResult = v.safeParse(EvmPrivateKeySchema, trimmed);
	if (keyResult.success) {
		const derivationResult = validateAndDeriveAddress(keyResult.output);
		if (!derivationResult.ok) {
			return { ok: false, error: derivationResult.error };
		}
		return {
			ok: true,
			type: "privateKey",
			address: derivationResult.address,
			privateKey: keyResult.output,
		};
	}

	// Try address (42 chars: 0x + 40 hex)
	const addressResult = v.safeParse(EvmAddressSchema, trimmed);
	if (addressResult.success) {
		return {
			ok: true,
			type: "address",
			address: addressResult.output,
			privateKey: null,
		};
	}

	return {
		ok: false,
		error:
			"Invalid input. Enter a private key (0x + 64 hex chars) or an address (0x + 40 hex chars).",
	};
}

/**
 * Securely wipes sensitive data from memory
 * Note: Only works for mutable data like Uint8Array, not strings
 */
export function secureWipe(data: Uint8Array): void {
	data.fill(0);
}
