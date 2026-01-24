import type {
	BalanceError,
	EnsNameError,
	GasEstimateError,
	TransactionCountError,
} from "@shared/types";

/**
 * Discriminated union type for all address-related errors
 */
export type AddressableError =
	| BalanceError
	| EnsNameError
	| TransactionCountError
	| GasEstimateError;

/**
 * Discriminated union type for all chain-related errors
 */
export type ChainableError =
	| BalanceError
	| TransactionCountError
	| GasEstimateError;

/**
 * Error codes that can be used in API responses
 */
export type ApiErrorCode =
	| "RATE_LIMITED"
	| "NETWORK_ERROR"
	| "API_ERROR"
	| "BROADCAST_FAILED";

/**
 * Creates an invalid address error based on the error type
 * @param errorType - The type of error to create
 * @returns A discriminated union error object
 */
export function invalidAddressError(
	errorType: "balance" | "ens" | "txCount" | "gasEstimate",
): AddressableError {
	const baseError = {
		ok: false as const,
		error: "Invalid Ethereum address format",
		code: "INVALID_ADDRESS" as const,
	};

	// Return the correct error type based on the errorType parameter
	// Use 'unknown' intermediate to satisfy type checker for discriminated unions
	switch (errorType) {
		case "balance":
			return baseError as unknown as BalanceError;
		case "ens":
			return baseError as unknown as EnsNameError;
		case "txCount":
			return baseError as unknown as TransactionCountError;
		case "gasEstimate":
			return baseError as unknown as GasEstimateError;
	}
}

/**
 * Creates an invalid chain error based on the error type
 * @param errorType - The type of error to create
 * @returns A discriminated union error object
 */
export function invalidChainError(
	errorType: "balance" | "txCount" | "gasEstimate",
): ChainableError {
	const errorMessages = {
		balance:
			"Invalid or unsupported chain ID. Supported: 1 (mainnet), 8453 (Base)",
		txCount: "Invalid or unsupported chain ID",
		gasEstimate: "Invalid or unsupported chain ID",
	};

	const baseError = {
		ok: false as const,
		error: errorMessages[errorType],
		code: "INVALID_CHAIN" as const,
	};

	// Return the correct error type based on the errorType parameter
	// Use 'unknown' intermediate to satisfy type checker for discriminated unions
	switch (errorType) {
		case "balance":
			return baseError as unknown as BalanceError;
		case "txCount":
			return baseError as unknown as TransactionCountError;
		case "gasEstimate":
			return baseError as unknown as GasEstimateError;
	}
}

/**
 * Creates an invalid BigInt format error
 * @param fieldName - The field name that failed validation
 * @returns A GasEstimateError for invalid BigInt format
 */
export function invalidBigIntError(
	fieldName: "value" | "amount",
): GasEstimateError {
	return {
		ok: false as const,
		error: `Invalid ${fieldName} format`,
		code: "NETWORK_ERROR" as const,
	};
}

/**
 * Creates a negative BigInt error
 * @param fieldName - The field name that failed validation
 * @returns A GasEstimateError for negative BigInt value
 */
export function negativeBigIntError(
	fieldName: "value" | "amount",
): GasEstimateError {
	return {
		ok: false as const,
		error: `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be non-negative`,
		code: "NETWORK_ERROR" as const,
	};
}

/**
 * Creates a generic API error with the specified code
 * @param message - The error message
 * @param code - The error code
 * @returns An error object with the specified code
 */
export function apiError(
	message: string,
	code: ApiErrorCode,
): { ok: false; error: string; code: typeof code } {
	return {
		ok: false,
		error: message,
		code,
	};
}

/**
 * Wraps an error in a standardized error response
 * @param error - The error to wrap
 * @returns A standardized error response with appropriate code
 */
export function wrapError(error: unknown): {
	ok: false;
	error: string;
	code: ApiErrorCode;
} {
	const errorMessage = error instanceof Error ? error.message : "Unknown error";
	const isRateLimit =
		errorMessage.includes("rate limit") || errorMessage.includes("429");
	return {
		ok: false as const,
		error: errorMessage,
		code: (isRateLimit ? "RATE_LIMITED" : "API_ERROR") as ApiErrorCode,
	};
}
