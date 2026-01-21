import type { AppName, BalanceResult, TransactionCountResult } from "./types";

/**
 * API endpoint definitions.
 *
 * Each endpoint defines:
 * - Path with parameter placeholders (e.g., :address)
 * - Expected query parameters
 * - Response type
 *
 * Backend: implements these routes
 * Frontend: consumes via typed itty-fetcher
 */
export const apiEndpoints = {
	/** GET /api/name - Get app name */
	name: {
		path: "/name" as const,
		method: "GET" as const,
	},

	/** GET /api/balance/:address?chainId={chainId} - Get ETH balance */
	balance: {
		path: "/balance/:address" as const,
		method: "GET" as const,
	},
	/** GET /api/transaction-count/:address?chainId={chainId} - Get nonce */
	transactionCount: {
		path: "/transaction-count/:address" as const,
		method: "GET" as const,
	},
} as const;

/** Response types for each endpoint */
export type ApiResponses = {
	name: AppName;
	balance: BalanceResult;
	transactionCount: TransactionCountResult;
};

/**
 * Helper to build URL from endpoint path and params
 */
export function buildUrl(
	path: string,
	params?: { address?: string; query?: Record<string, string> },
): string {
	const url = new URL(path, `${window.location.origin}/api`);

	if (params?.address) {
		url.pathname = url.pathname.replace(":address", params.address);
	}

	if (params?.query) {
		Object.entries(params.query).forEach(([key, value]) => {
			url.searchParams.set(key, value);
		});
	}

	return url.toString();
}
