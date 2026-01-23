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
