export const CLIPBOARD_TIMEOUT_MS = 12000;

// Sentinel values for deleted/cleared wallet data
// Used to overwrite sensitive fields on wallet deletion (defense-in-depth)
export const ZERO_ADDRESS_EVM = "0x0000000000000000000000000000000000000000";
// Tron's burn address (hex: 410000000000000000000000000000000000000000)
export const ZERO_ADDRESS_TRON = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";

// Format numbers with locale-aware thousands separators
export const formatWithLocale = new Intl.NumberFormat(undefined, {
	minimumFractionDigits: 2,
	maximumFractionDigits: 6,
});

export const formatTrc20 = new Intl.NumberFormat(undefined, {
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});

// Format USD values with thousands separators
export const formatUsd = new Intl.NumberFormat(undefined, {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export function formatPriceAge(timestamp: number): string {
	const ageMinutes = (Date.now() - timestamp) / (1000 * 60);
	if (ageMinutes < 5) return "fresh (<5 mins)";
	if (ageMinutes < 10) return "slightly stale (<10 mins)";
	return "very stale (>=10 mins)";
}

// Calculate opacity based on price age (fresh = 100%, 10min+ = 60%)
export function getPriceOpacity(timestamp: number): number {
	const ageMinutes = (Date.now() - timestamp) / (1000 * 60);
	if (ageMinutes < 5) return 1.0; // Fresh
	if (ageMinutes < 10) return 0.8; // Slightly stale
	return 0.6; // Very stale
}

/**
 * Simple pluralization helper.
 * Returns singular form when count is 1, plural form otherwise.
 * If plural not provided, appends "s" to singular.
 */
export function pluralize(
	count: number,
	singular: string,
	plural?: string,
): string {
	return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
