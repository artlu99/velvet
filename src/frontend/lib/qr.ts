import type { SupportedChainId } from "@shared/types";

/**
 * Result type for QR code value generation.
 * Uses discriminated union for type-safe error handling.
 */
export interface QRCodeSuccess {
	readonly ok: true;
	readonly value: string;
}

export interface QRCodeError {
	readonly ok: false;
	readonly error: string;
}

export type QRCodeResult = QRCodeSuccess | QRCodeError;

/**
 * Validates Ethereum address format (EIP-55 checksummed).
 * Basic validation: starts with 0x, 42 characters, hexadecimal.
 */
const isValidEthAddress = (address: string): boolean => {
	return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Builds QR code value for receiving crypto.
 * For MVP: returns plain address (no EIP-681 universal links).
 *
 * @param address - Wallet address to receive funds
 * @param _network - Network (ethereum/base) - unused for MVP, for future EIP-681
 * @returns QRCodeSuccess with address value, or QRCodeError if invalid
 */
export const buildReceiveQrValue = (
	address: string,
	_network: SupportedChainId,
): QRCodeResult => {
	if (!address || address.trim().length === 0) {
		return { ok: false, error: "Address is required" };
	}

	if (!isValidEthAddress(address)) {
		return { ok: false, error: "Invalid Ethereum address format" };
	}

	// MVP: plain address only (no EIP-681)
	return { ok: true, value: address };
};
