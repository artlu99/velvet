import type {
	AppName,
	BalanceResult,
	EnsNameResult,
	Erc20BalanceResult,
	Erc20GasEstimateResult,
	TransactionCountResult,
} from "./types";

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
		path: "name" as const,
		method: "GET" as const,
	},

	/** GET /api/balance/:address?chainId={chainId} - Get ETH balance */
	balance: {
		path: "balance/:address" as const,
		method: "GET" as const,
	},
	/** GET /api/transaction-count/:address?chainId={chainId} - Get nonce */
	transactionCount: {
		path: "transaction-count/:address" as const,
		method: "GET" as const,
	},
	/** GET /api/balance/erc20/:address/:contract?chainId={chainId} - Get ERC20 balance */
	erc20Balance: {
		path: "balance/erc20/:address/:contract" as const,
		method: "GET" as const,
	},
	/** GET /api/ens/:address - Get ENS name for address */
	ensName: {
		path: "ens/:address" as const,
		method: "GET" as const,
	},
	/** POST /api/estimate-gas/erc20 - Estimate ERC20 transfer gas */
	erc20GasEstimate: {
		path: "estimate-gas/erc20" as const,
		method: "POST" as const,
	},
} as const;

/** Response types for each endpoint */
export type ApiResponses = {
	name: AppName;
	balance: BalanceResult;
	transactionCount: TransactionCountResult;
	erc20Balance: Erc20BalanceResult;
	ensName: EnsNameResult;
	erc20GasEstimate: Erc20GasEstimateResult;
};

/**
 * Helper to build URL from endpoint path and params
 */
export function buildUrl(
	path: string,
	params?: {
		address?: string;
		contract?: string;
		query?: Record<string, string>;
	},
): string {
	// Important: trailing slash so relative paths append under /api/
	const url = new URL(path, `${window.location.origin}/api/`);

	if (params?.address) {
		url.pathname = url.pathname.replace(":address", params.address);
	}

	if (params?.contract) {
		url.pathname = url.pathname.replace(":contract", params.contract);
	}

	if (params?.query) {
		Object.entries(params.query).forEach(([key, value]) => {
			url.searchParams.set(key, value);
		});
	}

	return url.toString();
}
