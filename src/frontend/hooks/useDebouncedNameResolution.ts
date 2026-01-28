import { useEffect, useMemo, useRef, useState } from "react";
import { normalize } from "viem/ens";
import { useBasenameAddressQuery } from "~/hooks/queries/useBasenameQueries";
import { useEnsAddressQuery } from "~/hooks/queries/useEnsAddressQuery";

export type NameType = "ens" | "basename" | "unknown";

interface NameResolutionResult {
	address: string | null;
	isLoading: boolean;
	error: string | null;
	nameType: NameType;
}

/**
 * Custom hook for debounced ENS/Basename name resolution.
 * Delays API calls until user stops typing for 500ms.
 * Supports: .eth (ENS), .base.eth (Basename)
 *
 * @param input - The name input to resolve
 * @param delay - Debounce delay in milliseconds (default: 500ms)
 * @returns Resolution result with address, loading state, error, and name type
 */
export function useDebouncedNameResolution(
	input: string,
	delay = 500,
): NameResolutionResult {
	const [debouncedInput, setDebouncedInput] = useState(input);
	// Track if we've started loading to prevent flickering
	const hasStartedLoading = useRef(false);

	// Debounce input changes
	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedInput(input.trim());
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [input, delay]);

	// Reset loading state when input clears
	useEffect(() => {
		if (!input) {
			hasStartedLoading.current = false;
		}
	}, [input]);

	// Memoize normalization and type detection to avoid repeated work on every render
	const { nameType } = useMemo(() => {
		// Normalize name for type detection (ENSIP-15 canonical normalization)
		let normalized: string;
		try {
			normalized = normalize(debouncedInput);
			if (normalized !== debouncedInput) {
				console.log(`[NameResolution] Input normalized:`, {
					original: debouncedInput,
					normalized,
				});
			}
		} catch (error) {
			// If normalization fails, fall back to lowercase for basic detection
			console.warn(`[NameResolution] Normalization failed, using lowercase:`, {
				input: debouncedInput,
				error: error instanceof Error ? error.message : String(error),
			});
			normalized = debouncedInput.toLowerCase();
		}

		// Detect name type (check .base.eth before .eth since it also ends with .eth)
		// Use normalized name for case-insensitive detection
		const type: NameType = normalized.endsWith(".base.eth")
			? "basename"
			: normalized.endsWith(".eth")
				? "ens"
				: "unknown";

		if (debouncedInput && type !== "unknown") {
			console.log(`[NameResolution] Detected name type:`, {
				input: debouncedInput,
				normalized,
				nameType: type,
			});
		}

		return { nameType: type };
	}, [debouncedInput]);

	// Run appropriate query based on name type
	const ensQuery = useEnsAddressQuery({
		name: debouncedInput,
		enabled: nameType === "ens",
	});

	const basenameQuery = useBasenameAddressQuery({
		name: debouncedInput,
		enabled: nameType === "basename",
	});

	// Return appropriate query results with stabilized loading state
	if (nameType === "ens") {
		const ensAddress =
			ensQuery.data?.ok === true &&
			ensQuery.data.address &&
			typeof ensQuery.data.address === "string"
				? ensQuery.data.address
				: null;
		const error = ensQuery.data?.ok === false ? ensQuery.data.error : null;
		const hasResult = ensQuery.data !== undefined;
		const isLoading = ensQuery.isLoading;

		// Stabilize loading state: once we start loading, keep showing it until we have a result
		if (isLoading && !hasStartedLoading.current) {
			hasStartedLoading.current = true;
		}
		const stabilizedIsLoading =
			hasStartedLoading.current && !hasResult && !error;

		return {
			address: ensAddress,
			isLoading: stabilizedIsLoading,
			error,
			nameType,
		};
	}

	if (nameType === "basename") {
		const basenameAddress =
			basenameQuery.data?.ok === true &&
			basenameQuery.data.address &&
			typeof basenameQuery.data.address === "string"
				? basenameQuery.data.address
				: null;
		const error =
			basenameQuery.data?.ok === false ? basenameQuery.data.error : null;
		const hasResult = basenameQuery.data !== undefined;
		const isLoading = basenameQuery.isLoading;

		// Stabilize loading state: once we start loading, keep showing it until we have a result
		if (isLoading && !hasStartedLoading.current) {
			hasStartedLoading.current = true;
		}
		const stabilizedIsLoading =
			hasStartedLoading.current && !hasResult && !error;

		return {
			address: basenameAddress,
			isLoading: stabilizedIsLoading,
			error,
			nameType,
		};
	}

	// Unknown name type - reset loading state
	hasStartedLoading.current = false;
	return {
		address: null,
		isLoading: false,
		error: null,
		nameType: "unknown",
	};
}
