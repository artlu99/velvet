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
 * Securely wipes sensitive data from memory
 * Note: Only works for mutable data like Uint8Array, not strings
 */
export function secureWipe(data: Uint8Array): void {
	data.fill(0);
}
