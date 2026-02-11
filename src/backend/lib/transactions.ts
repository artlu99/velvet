/**
 * Transaction history fetching with smart dust filtering
 *
 * Fetches transaction history from Etherscan and filters out:
 * - Dust attacks (sub-cent USD values)
 * - Zero-value ERC20 transfers
 * - Gas waste attacks (gas cost > transaction value)
 */

import type { SupportedChainId } from "@shared/types";
import type { Context } from "hono";
import { fetcher } from "itty-fetcher";
import invariant from "tiny-invariant";
import { withCache } from "./cache";

/**
 * Etherscan API client for transaction history
 */
const etherscanApi = fetcher({
	base: "https://api.etherscan.io/v2/api",
});

const USD_THRESHOLD = 0.01; // $0.01 minimum USD value

export interface RawTransaction {
	hash: string;
	from: string;
	to: string | null;
	value: string;
	gasUsed: string;
	gasPrice: string;
	methodId: string;
	timeStamp: string;
}

export interface FilteredTx {
	hash: string;
	from: string;
	to: string | null;
	value: string;
	gasUsed: string;
	gasPrice: string;
	methodId: string;
	timeStamp: string;
	estimatedUsdValue: number;
}

interface TxListResult {
	ok: true;
	data: Array<FilteredTx>;
	timestamp: number;
}

/**
 * Business logic: Filter out spam/dust transactions
 *
 * Rules:
 * 1. Filter zero-value ERC20 transfers (methodId: 0xa9059cbb, value: 0)
 * 2. Filter where gas cost > transaction value (for native transfers only)
 * 3. Filter by USD threshold (only for native ETH transfers)
 *
 * Note: We only apply USD and gas filtering to native ETH transfers
 * because we don't have token metadata (decimals, price) for ERC20s
 */
function filterLegitimateTransactions(
	txs: Array<RawTransaction>,
	ethPriceUsd: number,
): Array<FilteredTx> {
	return txs
		.filter((tx) => {
			const value = BigInt(tx.value);
			const gasCost = BigInt(tx.gasUsed) * BigInt(tx.gasPrice);
			const methodId = tx.methodId || "0x";
			const isErc20Transfer = methodId === "0xa9059cbb";

			// Rule 1: Filter out zero-value ERC20 transfers
			if (isErc20Transfer && value === 0n) {
				return false;
			}

			// For ERC20 with value > 0, we allow it (no USD/gas filtering without token metadata)
			if (isErc20Transfer) {
				return true;
			}

			// Rule 2: Filter gas waste attacks (native ETH only)
			// Filter when gas cost >= transaction value (protect against gas waste)
			if (gasCost >= value) {
				return false;
			}

			// Rule 3: Filter by USD threshold (native ETH only)
			const ethValue = Number(value) / 1e18;
			const estimatedUsd = ethValue * ethPriceUsd;

			if (estimatedUsd < USD_THRESHOLD) {
				return false;
			}

			return true;
		})
		.map((tx) => {
			// Only calculate USD for native ETH
			const isErc20Transfer = (tx.methodId || "0x") === "0xa9059cbb";
			if (isErc20Transfer) {
				return {
					...tx,
					estimatedUsdValue: 0, // Can't calculate without token price
				};
			}

			const ethValue = Number(BigInt(tx.value)) / 1e18;
			return {
				...tx,
				estimatedUsdValue: ethValue * ethPriceUsd,
			};
		});
}

/**
 * Fetch transaction list from Etherscan with smart filtering
 */
export async function fetchTransactionList(
	env: Env,
	chainId: SupportedChainId,
	address: string,
	ethPriceUsd: number,
): Promise<TxListResult> {
	invariant(env.ETHERSCAN_API_KEY, "ETHERSCAN_API_KEY is not set");
	const url = `?module=account&action=txlist&address=${address}&chainid=${chainId}&apiKey=${env.ETHERSCAN_API_KEY}`;
	const response = await etherscanApi.get(url);

	if (response.data.status !== "1" || !Array.isArray(response.data.result)) {
		return {
			ok: true,
			data: [],
			timestamp: Date.now(),
		};
	}

	const rawTxs = response.data.result as Array<RawTransaction>;

	// Apply smart filtering
	const filteredTxs = filterLegitimateTransactions(rawTxs, ethPriceUsd);

	return {
		ok: true,
		data: filteredTxs,
		timestamp: Date.now(),
	};
}

/**
 * Hono handler: Get transaction list for an address
 */
export async function getTransactionList(
	c: Context,
	chainId: 1 | 8453,
	address: string,
	ethPriceUsd: number,
): Promise<TxListResult> {
	return withCache(c, {
		cacheKey: `txlist:${chainId}:${address}`,
		cacheBust: c.req.query("cacheBust"),
		headerName: "x-txlist-cache",
		ttl: 60, // 60 seconds
		fetcher: async () =>
			fetchTransactionList(c.env, chainId, address, ethPriceUsd),
	});
}
