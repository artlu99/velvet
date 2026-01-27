import { useEffect, useState } from "react";
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

	// Debounce input changes
	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedInput(input.trim());
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [input, delay]);

	// Normalize name for type detection (ENSIP-15 canonical normalization)
	let normalizedForType: string;
	try {
		normalizedForType = normalize(debouncedInput);
		if (normalizedForType !== debouncedInput) {
			console.log(`[NameResolution] Input normalized:`, {
				original: debouncedInput,
				normalized: normalizedForType,
			});
		}
	} catch (error) {
		// If normalization fails, fall back to lowercase for basic detection
		console.warn(`[NameResolution] Normalization failed, using lowercase:`, {
			input: debouncedInput,
			error: error instanceof Error ? error.message : String(error),
		});
		normalizedForType = debouncedInput.toLowerCase();
	}

	// Detect name type (check .base.eth before .eth since it also ends with .eth)
	// Use normalized name for case-insensitive detection
	const nameType: NameType = normalizedForType.endsWith(".base.eth")
		? "basename"
		: normalizedForType.endsWith(".eth")
			? "ens"
			: "unknown";

	if (debouncedInput && nameType !== "unknown") {
		console.log(`[NameResolution] Detected name type:`, {
			input: debouncedInput,
			normalized: normalizedForType,
			nameType,
		});
	}

	// Run appropriate query based on name type
	const ensQuery = useEnsAddressQuery({
		name: debouncedInput,
		enabled: nameType === "ens",
	});

	const basenameQuery = useBasenameAddressQuery({
		name: debouncedInput,
		enabled: nameType === "basename",
	});

	// Return appropriate query results
	if (nameType === "ens") {
		const ensAddress =
			ensQuery.data?.ok === true &&
			ensQuery.data.address &&
			typeof ensQuery.data.address === "string"
				? ensQuery.data.address
				: null;
		const error = ensQuery.data?.ok === false ? ensQuery.data.error : null;
		return {
			address: ensAddress,
			isLoading: ensQuery.isLoading,
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
		return {
			address: basenameAddress,
			isLoading: basenameQuery.isLoading,
			error,
			nameType,
		};
	}

	// Unknown name type
	return {
		address: null,
		isLoading: false,
		error: null,
		nameType: "unknown",
	};
}
