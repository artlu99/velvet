import type {
	AppName,
	BalanceResult,
	Erc20BalanceResult,
	Erc20GasEstimateResult,
	PlatformMetadataResult,
	PricesResult,
	TokenMetadataResult,
	TransactionCountResult,
	Trc20BalanceResult,
	TronBalanceResult,
	TronBroadcastResult,
	TronGasEstimateResult,
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
	/** POST /api/estimate-gas/erc20 - Estimate ERC20 transfer gas */
	erc20GasEstimate: {
		path: "estimate-gas/erc20" as const,
		method: "POST" as const,
	},
	/** GET /api/balance/tron/:address - Get TRX balance */
	tronBalance: {
		path: "balance/tron/:address" as const,
		method: "GET" as const,
	},
	/** GET /api/balance/trc20/:address/:contract - Get TRC20 balance */
	trc20Balance: {
		path: "balance/trc20/:address/:contract" as const,
		method: "GET" as const,
	},
	/** POST /api/estimate-gas/tron - Estimate TRC20 transfer gas */
	tronGasEstimate: {
		path: "estimate-gas/tron" as const,
		method: "POST" as const,
	},
	/** POST /api/broadcast-transaction/tron - Broadcast Tron transaction */
	tronBroadcast: {
		path: "broadcast-transaction/tron" as const,
		method: "POST" as const,
	},
	/** GET /api/prices?ids={ids} - Get CoinGecko prices */
	prices: {
		path: "prices" as const,
		method: "GET" as const,
	},
	/** GET /api/tokens/metadata?ids={ids} - Get token metadata (logos) */
	tokensMetadata: {
		path: "tokens/metadata" as const,
		method: "GET" as const,
	},
	/** GET /api/platforms/metadata - Get platform/chain metadata (logos) */
	platformsMetadata: {
		path: "platforms/metadata" as const,
		method: "GET" as const,
	},
} as const;

/** Response types for each endpoint */
export type ApiResponses = {
	name: AppName;
	balance: BalanceResult;
	transactionCount: TransactionCountResult;
	erc20Balance: Erc20BalanceResult;
	erc20GasEstimate: Erc20GasEstimateResult;
	tronBalance: TronBalanceResult;
	trc20Balance: Trc20BalanceResult;
	tronGasEstimate: TronGasEstimateResult;
	tronBroadcast: TronBroadcastResult;
	prices: PricesResult;
	tokensMetadata: TokenMetadataResult;
	platformsMetadata: PlatformMetadataResult;
};

/**
 * Helper to build URL from endpoint path and params
 */
export function buildUrl(
	path: string,
	params?: {
		address?: string;
		name?: string;
		contract?: string;
		query?: Record<string, string>;
	},
): string {
	// Important: trailing slash so relative paths append under /api/
	const url = new URL(path, `${window.location.origin}/api/`);

	if (params?.address) {
		url.pathname = url.pathname.replace(":address", params.address);
	}

	if (params?.name) {
		url.pathname = url.pathname.replace(":name", params.name);
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
