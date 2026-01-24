import type {
	BalanceError,
	EnsNameError,
	GasEstimateError,
	TransactionCountError,
} from "@shared/types";
import { getAddress, isAddress } from "viem";
import { isSupportedChainId, parseChainId } from "./balance";
import {
	invalidAddressError,
	invalidBigIntError,
	invalidChainError,
	negativeBigIntError,
} from "./errors";

/**
 * Result types for address validation
 */
export interface AddressValidationResult {
	ok: true;
	address: string;
	normalized: string;
}

export interface AddressValidationError {
	ok: false;
	error: BalanceError | EnsNameError | TransactionCountError | GasEstimateError;
}

export type AddressValidation =
	| AddressValidationResult
	| AddressValidationError;

/**
 * Result types for chain ID validation
 */
export interface ChainIdValidationResult {
	ok: true;
	chainId: number;
}

export interface ChainIdValidationError {
	ok: false;
	error: BalanceError | TransactionCountError | GasEstimateError;
}

export type ChainIdValidation =
	| ChainIdValidationResult
	| ChainIdValidationError;

/**
 * Result types for BigInt parsing
 */
export interface BigIntValidationResult {
	ok: true;
	value: bigint;
}

export interface BigIntValidationError {
	ok: false;
	error: GasEstimateError;
}

export type BigIntValidation = BigIntValidationResult | BigIntValidationError;

/**
 * Validates an Ethereum address and returns the normalized form
 * @param address - The address to validate
 * @param errorType - The type of error to return if validation fails
 * @returns A discriminated union with either the validated address or an error
 */
export function validateAddress(
	address: string,
	errorType: "balance" | "ens" | "txCount" | "gasEstimate",
): AddressValidation {
	if (!isAddress(address)) {
		return { ok: false, error: invalidAddressError(errorType) };
	}

	// For ens endpoint, we return checksummed address
	// For balance/txCount/gasEstimate, we return lowercase
	const normalized =
		errorType === "ens" ? getAddress(address) : address.toLowerCase();

	return { ok: true, address, normalized };
}

/**
 * Validates a chain ID parameter and returns the parsed chain ID
 * @param chainIdParam - The chain ID parameter from the request
 * @param errorType - The type of error to return if validation fails
 * @returns A discriminated union with either the validated chain ID or an error
 */
export function validateChainId(
	chainIdParam: string | undefined,
	errorType: "balance" | "txCount" | "gasEstimate",
): ChainIdValidation {
	const chainId = parseChainId(chainIdParam);
	if (
		chainId === null ||
		!isSupportedChainId(chainId) ||
		!isNumericChainId(chainId)
	) {
		return { ok: false, error: invalidChainError(errorType) };
	}

	return { ok: true, chainId };
}

/**
 * Parses a BigInt value from a string with validation
 * @param value - The string value to parse
 * @param fieldName - The field name for error messages
 * @returns A discriminated union with either the parsed bigint or an error
 */
export function parseBigInt(
	value: string,
	fieldName: "value" | "amount",
): BigIntValidation {
	try {
		const parsed = BigInt(value);
		if (parsed < 0n) {
			return { ok: false, error: negativeBigIntError(fieldName) };
		}
		return { ok: true, value: parsed };
	} catch {
		return { ok: false, error: invalidBigIntError(fieldName) };
	}
}

/**
 * Type guard to check if chain ID is numeric (not "tron" string)
 */
export function isNumericChainId(chainId: string | number): chainId is number {
	return (
		typeof chainId === "number" ||
		(typeof chainId === "string" && chainId !== "tron")
	);
}
