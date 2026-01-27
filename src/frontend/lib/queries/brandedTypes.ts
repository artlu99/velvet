import { NonEmptyString100, NonEmptyString1000 } from "@evolu/common";

/**
 * Helper functions to create branded types from plain strings for use in Evolu queries.
 * These functions validate the input at runtime and return branded types for type-safe `.where()` clauses.
 *
 * Branded types are compile-time only - at runtime they're just strings.
 * These helpers ensure type safety by validating constraints before returning branded types.
 */

/**
 * Creates a NonEmptyString1000 branded type from a plain string.
 * Validates that the string is non-empty and has length <= 1000.
 */
export function asNonEmptyString1000(value: string): NonEmptyString1000 {
	if (value.length === 0) {
		throw new Error("String must be non-empty");
	}
	if (value.length > 1000) {
		throw new Error(`String length ${value.length} exceeds maximum of 1000`);
	}
	return NonEmptyString1000.orThrow(value);
}

/**
 * Creates a NonEmptyString100 branded type from a plain string.
 * Validates that the string is non-empty and has length <= 100.
 */
export function asNonEmptyString100(value: string): NonEmptyString100 {
	if (value.length === 0) {
		throw new Error("String must be non-empty");
	}
	if (value.length > 100) {
		throw new Error(`String length ${value.length} exceeds maximum of 100`);
	}
	return NonEmptyString100.orThrow(value);
}
