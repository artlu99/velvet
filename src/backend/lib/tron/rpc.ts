/**
 * RPC client for interacting with Tron network via TronGrid API.
 */

import type {
	Trc20BalanceError,
	Trc20BalanceResult,
	Trc20BalanceSuccess,
	TronBalanceError,
	TronBalanceResult,
	TronBalanceSuccess,
	TronBroadcastError,
	TronBroadcastResult,
	TronBroadcastSuccess,
	TronGasEstimateError,
	TronGasEstimateResult,
	TronGasEstimateSuccess,
} from "@shared/types";

const SUN_PER_TRX = 1_000_000;

/**
 * Get TronGrid API URL with API key header
 */
function getTronGridConfig(env: Env): { url: string; headers: HeadersInit } {
	return {
		url: env.TRONGRID_API_URL ?? "https://api.trongrid.io",
		headers: {
			"TRON-PRO-API-KEY": env.TRONGRID_API_KEY ?? "",
			"Content-Type": "application/json",
		},
	};
}

/**
 * Fetches TRX balance for an address
 */
export async function getTronBalance(
	env: Env,
	address: string,
): Promise<TronBalanceResult> {
	try {
		const config = getTronGridConfig(env);
		const response = await fetch(`${config.url}/v1/accounts/${address}`, {
			headers: config.headers,
		});

		if (!response.ok) {
			return {
				ok: false,
				error: `TronGrid API error: ${response.statusText}`,
				code: "NETWORK_ERROR",
			};
		}

		const data = (await response.json()) as {
			data: Array<{ balance?: string }>;
		};
		const account = data.data?.[0];

		if (!account) {
			return {
				ok: true,
				address,
				balanceTrx: "0",
				balanceSun: "0",
				bandwidth: { free: 0, used: 0 },
				energy: { free: 0, used: 0 },
				timestamp: Date.now(),
			};
		}

		const balanceSun = account.balance ?? "0";
		const balanceTrx = (Number(balanceSun) / SUN_PER_TRX).toFixed(6);

		return {
			ok: true,
			address,
			balanceTrx,
			balanceSun,
			bandwidth: { free: 0, used: 0 },
			energy: { free: 0, used: 0 },
			timestamp: Date.now(),
		} satisfies TronBalanceSuccess;
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Unknown error",
			code: "NETWORK_ERROR",
		} satisfies TronBalanceError;
	}
}

/**
 * Fetches TRC20 token balance for an address
 */
export async function getTrc20Balance(
	env: Env,
	address: string,
	contract: string,
): Promise<Trc20BalanceResult> {
	try {
		const config = getTronGridConfig(env);
		const response = await fetch(
			`${config.url}/v1/accounts/${address}/transactions/trc20?limit=1&contract_address=${contract}`,
			{
				headers: config.headers,
			},
		);

		if (!response.ok) {
			return {
				ok: false,
				error: `TronGrid API error: ${response.statusText}`,
				code: "NETWORK_ERROR",
			};
		}

		const data = (await response.json()) as {
			data?: Array<{ type?: string; value?: string; to_address?: string }>;
		};

		const tokenData = data.data?.[0];
		const balanceRaw = tokenData?.value ?? "0";

		return {
			ok: true,
			address,
			contract,
			symbol: "USDT",
			decimals: 6,
			balanceRaw,
			balanceFormatted: (Number(balanceRaw) / 1_000_000).toFixed(6),
			timestamp: Date.now(),
		} satisfies Trc20BalanceSuccess;
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Unknown error",
			code: "NETWORK_ERROR",
		} satisfies Trc20BalanceError;
	}
}

/**
 * Estimates bandwidth for native TRX transfer
 *
 * Native TRX transfers consume bandwidth (not energy).
 * The bandwidth cost is typically around 260-350 bandwidth points.
 * 1 TRX can purchase ~1 bandwidth points if needed.
 */
export async function estimateTrxTransfer(
	_env: Env,
	_from: string,
	_to: string,
	_amount: string,
): Promise<TronGasEstimateResult> {
	// Native TRX transfers have a fixed low cost (~1 SUN or less for bandwidth)
	// Most accounts get free bandwidth daily
	const BANDWIDTH_COST = 280; // Typical cost for TRX transfer
	const BANDWIDTH_PRICE_SUN = 1; // 1 SUN per bandwidth point if not free
	const totalCostSun = BANDWIDTH_COST * BANDWIDTH_PRICE_SUN;
	const totalCostTrx = (totalCostSun / SUN_PER_TRX).toFixed(6);

	return {
		ok: true,
		bandwidthRequired: BANDWIDTH_COST,
		energyRequired: 0,
		energyFee: "0",
		totalCostTrx,
	} satisfies TronGasEstimateSuccess;
}

/**
 * Estimates bandwidth/energy for TRC20 transfer
 */
export async function estimateTrc20Transfer(
	env: Env,
	from: string,
	to: string,
	contract: string,
	amount: string,
): Promise<TronGasEstimateResult> {
	try {
		const config = getTronGridConfig(env);
		const response = await fetch(`${config.url}/wallet/estimateenergy`, {
			method: "POST",
			headers: config.headers,
			body: JSON.stringify({
				owner_address: from,
				to_address: to,
				contract_address: contract,
				function_selector: "transfer(address,uint256)",
				parameter: [
					{ type: "address", value: to },
					{ type: "uint256", value: amount },
				],
			}),
		});

		if (!response.ok) {
			return {
				ok: false,
				error: `TronGrid API error: ${response.statusText}`,
				code: "NETWORK_ERROR",
			};
		}

		const data = (await response.json()) as {
			energy_required?: number;
		};

		const energyRequired = data.energy_required ?? 0;

		return {
			ok: true,
			bandwidthRequired: 0,
			energyRequired,
			energyFee: "0",
			totalCostTrx: "0",
		} satisfies TronGasEstimateSuccess;
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Unknown error",
			code: "NETWORK_ERROR",
		} satisfies TronGasEstimateError;
	}
}

/**
 * Broadcasts a signed Tron transaction
 */
export async function broadcastTronTransaction(
	env: Env,
	signedTransaction: string,
): Promise<TronBroadcastResult> {
	try {
		const config = getTronGridConfig(env);
		const response = await fetch(`${config.url}/wallet/broadcasttransaction`, {
			method: "POST",
			headers: config.headers,
			body: signedTransaction,
		});

		if (!response.ok) {
			return {
				ok: false,
				error: `TronGrid API error: ${response.statusText}`,
				code: "BROADCAST_FAILED",
			};
		}

		const data = (await response.json()) as {
			txid?: string;
			Error?: string;
		};

		if (data.Error) {
			return {
				ok: false,
				error: data.Error,
				code: "BROADCAST_FAILED",
			};
		}

		if (!data.txid) {
			return {
				ok: false,
				error: "No transaction hash returned",
				code: "BROADCAST_FAILED",
			};
		}

		return {
			ok: true,
			txHash: data.txid,
		} satisfies TronBroadcastSuccess;
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Unknown error",
			code: "BROADCAST_FAILED",
		} satisfies TronBroadcastError;
	}
}
