import type {
	AppName,
	BroadcastTransactionRequest,
	Erc20GasEstimateRequest,
	GasEstimateRequest,
	TransactionReceiptResult,
	TronGasEstimateRequest,
} from "@shared/types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import invariant from "tiny-invariant";
import { formatEther } from "viem";
import { fetchBalance, isSupportedChainId } from "./lib/balance";
import { withCache } from "./lib/cache";
import {
	fetchAssetPlatforms,
	fetchPrices,
	fetchTokenMetadata,
} from "./lib/coingecko";
import { estimateErc20Transfer, fetchErc20Balance } from "./lib/erc20";
import { wrapError } from "./lib/errors";
import {
	broadcastTransaction,
	estimateGas,
	estimateGasCost,
	getTransactionCount,
	getTransactionReceipt,
} from "./lib/rpc";
import { getTransactionList } from "./lib/transactions";
import {
	broadcastTronTransaction,
	estimateTrc20Transfer,
	estimateTrxTransfer,
	getTrc20Balance,
	getTronBalance,
} from "./lib/tron/rpc";
import {
	isNumericChainId,
	parseBigInt,
	validateAddress,
	validateChainId,
} from "./lib/validation";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

const BALANCE_CACHE_TTL_SECONDS = 150; // 2.5 minutes

app
	.use(cors())
	.use(secureHeaders())
	.use(csrf())
	// ===== GET Routes =====
	// Metadata & Market Data
	.get("/name", (c) => {
		invariant(c.env.NAME, "NAME is not set");
		const ret: AppName = { name: c.env.NAME };
		return c.json(ret);
	})
	.get("/prices", async (c) => {
		// Parse coin IDs from query param
		const idsParam = c.req.query("ids");
		const coinIds = idsParam
			? idsParam.split(",").map((id) => id.trim())
			: ["ethereum", "tron", "usd-coin", "tether"];

		// Sort IDs to normalize cache key
		const sortedIds = [...coinIds].sort().join(",");
		const cacheKey = `prices:${sortedIds}`;

		try {
			const result = await withCache(c, {
				cacheKey,
				cacheBust: c.req.query("cacheBust"),
				headerName: "x-prices-cache",
				ttl: BALANCE_CACHE_TTL_SECONDS,
				fetcher: async () => {
					invariant(
						c.env.COINGECKO_API_KEY,
						"COINGECKO_API_KEY is not set in environment",
					);
					const prices = await fetchPrices({
						env: c.env,
						coinIds,
					});
					return {
						ok: true as const,
						prices,
						timestamp: Date.now(),
					};
				},
			});

			return c.json(result);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const isRateLimit =
				errorMessage.includes("rate limit") || errorMessage.includes("429");
			const errorResult = {
				ok: false as const,
				error: errorMessage,
				code: isRateLimit ? ("RATE_LIMITED" as const) : ("API_ERROR" as const),
			};
			return c.json(errorResult, isRateLimit ? 429 : 502);
		}
	})
	.get("/tokens/metadata", async (c) => {
		// Parse coin IDs from query param
		const idsParam = c.req.query("ids");
		const coinIds = idsParam
			? idsParam.split(",").map((id) => id.trim())
			: ["ethereum", "tron", "usd-coin", "tether"];

		// Sort IDs to normalize cache key
		const sortedIds = [...coinIds].sort().join(",");
		const cacheKey = `tokenMetadata:${sortedIds}`;

		try {
			const result = await withCache(c, {
				cacheKey,
				cacheBust: c.req.query("cacheBust"),
				headerName: "x-metadata-cache",
				ttl: 60 * 60 * 24, // 24 hours - token logos are static
				fetcher: async () => {
					invariant(
						c.env.COINGECKO_API_KEY,
						"COINGECKO_API_KEY is not set in environment",
					);
					const tokens = await fetchTokenMetadata({
						env: c.env,
						coinIds,
					});
					return {
						ok: true as const,
						tokens,
						timestamp: Date.now(),
					};
				},
			});

			return c.json(result);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const isRateLimit =
				errorMessage.includes("rate limit") || errorMessage.includes("429");
			const errorResult = {
				ok: false as const,
				error: errorMessage,
				code: isRateLimit ? ("RATE_LIMITED" as const) : ("API_ERROR" as const),
			};
			return c.json(errorResult, isRateLimit ? 429 : 502);
		}
	})
	.get("/platforms/metadata", async (c) => {
		const cacheKey = "assetPlatforms";

		try {
			const result = await withCache(c, {
				cacheKey,
				cacheBust: c.req.query("cacheBust"),
				headerName: "x-platforms-cache",
				ttl: 60 * 60 * 24 * 7, // 7 days - platform logos rarely change
				fetcher: async () => {
					invariant(
						c.env.COINGECKO_API_KEY,
						"COINGECKO_API_KEY is not set in environment",
					);
					const platforms = await fetchAssetPlatforms(c.env);
					return {
						ok: true as const,
						platforms,
						timestamp: Date.now(),
					};
				},
			});

			return c.json(result);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const isRateLimit =
				errorMessage.includes("rate limit") || errorMessage.includes("429");
			const errorResult = {
				ok: false as const,
				error: errorMessage,
				code: isRateLimit ? ("RATE_LIMITED" as const) : ("API_ERROR" as const),
			};
			return c.json(errorResult, isRateLimit ? 429 : 502);
		}
	})
	// Balance Queries
	.get("/balance/:address", async (c) => {
		try {
			const address = c.req.param("address");

			// Validate address
			const addressValidation = validateAddress(address, "balance");
			if (!addressValidation.ok) return c.json(addressValidation.error, 400);

			// Validate chainId
			const chainIdValidation = validateChainId(
				c.req.query("chainId"),
				"balance",
			);
			if (!chainIdValidation.ok) return c.json(chainIdValidation.error, 400);

			const result = await withCache(c, {
				cacheKey: `balance:${chainIdValidation.chainId}:${addressValidation.address}`,
				cacheBust: c.req.query("cacheBust"),
				headerName: "x-balance-cache",
				ttl: BALANCE_CACHE_TTL_SECONDS,
				fetcher: async () => {
					invariant(c.env.ETHERSCAN_API_KEY, "ETHERSCAN_API_KEY is not set");
					return fetchBalance(
						addressValidation.address,
						chainIdValidation.chainId as 1 | 8453,
						c.env.ETHERSCAN_API_KEY,
					);
				},
			});

			if (!result.ok) {
				console.error(
					`error getting balance:${chainIdValidation.chainId}:${addressValidation.address}`,
				);
				const status = result.code === "RATE_LIMITED" ? 429 : 502;
				return c.json(result, status);
			}

			return c.json(result);
		} catch (error) {
			const errorResult = wrapError(error);
			const status = errorResult.code === "RATE_LIMITED" ? 429 : 502;
			return c.json(errorResult, status);
		}
	})
	.get("/balance/erc20/:address/:contract", async (c) => {
		try {
			const address = c.req.param("address");
			const contract = c.req.param("contract");

			// Validate both addresses
			const addressValidation = validateAddress(address, "balance");
			if (!addressValidation.ok) {
				return c.json(
					{ ok: false, error: "Invalid address", code: "INVALID_ADDRESS" },
					400,
				);
			}

			const contractValidation = validateAddress(contract, "balance");
			if (!contractValidation.ok) {
				return c.json(
					{ ok: false, error: "Invalid address", code: "INVALID_ADDRESS" },
					400,
				);
			}

			// Validate chainId
			const chainIdValidation = validateChainId(
				c.req.query("chainId"),
				"balance",
			);
			if (!chainIdValidation.ok) {
				return c.json(
					{ ok: false, error: "Invalid chain", code: "INVALID_CHAIN" },
					400,
				);
			}

			const result = await withCache(c, {
				cacheKey: `erc20Balance:${chainIdValidation.chainId}:${addressValidation.address}:${contractValidation.address}`,
				cacheBust: c.req.query("cacheBust"),
				headerName: "x-balance-cache",
				ttl: BALANCE_CACHE_TTL_SECONDS,
				fetcher: () =>
					fetchErc20Balance(
						c.env,
						addressValidation.address,
						contractValidation.address,
						chainIdValidation.chainId,
					),
			});

			if (!result.ok) return c.json(result, 502);
			return c.json(result);
		} catch (error) {
			const errorResult = wrapError(error);
			const status = errorResult.code === "RATE_LIMITED" ? 429 : 502;
			return c.json(errorResult, status);
		}
	})
	.get("/balance/tron/:address", async (c) => {
		try {
			const address = c.req.param("address");

			const result = await withCache(c, {
				cacheKey: `tronBalance:${address}`,
				cacheBust: c.req.query("cacheBust"),
				headerName: "x-balance-cache",
				ttl: BALANCE_CACHE_TTL_SECONDS,
				fetcher: () => getTronBalance(c.env, address),
			});

			if (!result.ok) {
				const status = result.code === "INVALID_TRON_ADDRESS" ? 400 : 502;
				return c.json(result, status);
			}

			return c.json(result);
		} catch (error) {
			const errorResult = wrapError(error);
			const status = errorResult.code === "RATE_LIMITED" ? 429 : 502;
			return c.json(errorResult, status);
		}
	})
	.get("/balance/trc20/:address/:contract", async (c) => {
		try {
			const address = c.req.param("address");
			const contract = c.req.param("contract");

			const result = await withCache(c, {
				cacheKey: `trc20Balance:${address}:${contract}`,
				cacheBust: c.req.query("cacheBust"),
				headerName: "x-balance-cache",
				ttl: BALANCE_CACHE_TTL_SECONDS,
				fetcher: () => getTrc20Balance(c.env, address, contract),
			});

			if (!result.ok) {
				const status =
					result.code === "INVALID_TRON_ADDRESS" ||
					result.code === "INVALID_CONTRACT"
						? 400
						: 502;
				return c.json(result, status);
			}

			return c.json(result);
		} catch (error) {
			const errorResult = wrapError(error);
			const status = errorResult.code === "RATE_LIMITED" ? 429 : 502;
			return c.json(errorResult, status);
		}
	})
	.get("/transaction-count/:address", async (c) => {
		const address = c.req.param("address");

		// Validate address
		const addressValidation = validateAddress(address, "txCount");
		if (!addressValidation.ok) return c.json(addressValidation.error, 400);

		// Validate chainId
		const chainIdValidation = validateChainId(
			c.req.query("chainId"),
			"txCount",
		);
		if (!chainIdValidation.ok) return c.json(chainIdValidation.error, 400);

		try {
			const nonce = await getTransactionCount(
				c.env,
				addressValidation.address,
				chainIdValidation.chainId,
			);
			return c.json({
				ok: true,
				nonce,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const err = {
				ok: false,
				error: `Failed to fetch transaction count: ${errorMessage}`,
				code: "NETWORK_ERROR",
			} as const;
			return c.json(err, 500);
		}
	})
	.get("/transactions/:address", async (c) => {
		const address = c.req.param("address");
		const chainIdParam = c.req.query("chainId");

		// Validate address
		const addressValidation = validateAddress(address, "transactions");
		if (!addressValidation.ok) return c.json(addressValidation.error, 400);

		// For Tron, return empty array (not supported)
		if (chainIdParam === "tron") {
			return c.json({
				ok: true,
				data: [],
				timestamp: Date.now(),
			});
		}

		// Validate chainId (only numeric chains)
		const chainIdValidation = validateChainId(chainIdParam, "transactions");
		if (!chainIdValidation.ok) return c.json(chainIdValidation.error, 400);

		// At this point, chainId is guaranteed to be 1 | 8453
		const numericChainId = chainIdValidation.chainId as 1 | 8453;

		try {
			// Get current ETH price for USD filtering
			const prices = await fetchPrices({ env: c.env, coinIds: ["ethereum"] });
			const ethPriceUsd = prices.ethereum?.usd ?? 2000;

			const result = await getTransactionList(
				c,
				numericChainId,
				addressValidation.address,
				ethPriceUsd,
			);
			return c.json(result);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const err = {
				ok: false,
				error: `Failed to fetch transaction list: ${errorMessage}`,
				code: "NETWORK_ERROR",
			} as const;
			return c.json(err, 500);
		}
	})
	.get("/transaction/:txHash", async (c) => {
		const txHash = c.req.param("txHash");
		const chainIdParam = c.req.query("chainId");

		// Validate transaction hash format
		if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
			return c.json(
				{
					ok: false,
					error: "Invalid transaction hash format",
					code: "INVALID_TRANSACTION",
				},
				400,
			);
		}

		// For Tron, return error (not supported)
		if (chainIdParam === "tron") {
			return c.json(
				{
					ok: false,
					error: "Transaction receipt lookup not supported for Tron",
					code: "NOT_FOUND",
				},
				400,
			);
		}

		// Validate chainId (only numeric chains)
		const chainIdValidation = validateChainId(chainIdParam, "transactions");
		if (!chainIdValidation.ok) return c.json(chainIdValidation.error, 400);

		// At this point, chainId is guaranteed to be 1 | 8453
		const numericChainId = chainIdValidation.chainId as 1 | 8453;

		try {
			const receipt = await getTransactionReceipt(
				c.env,
				txHash as `0x${string}`,
				numericChainId,
			);

			if (!receipt) {
				return c.json(
					{
						ok: false,
						error: "Transaction not found or not yet confirmed",
						code: "NOT_FOUND",
					} as TransactionReceiptResult,
					404,
				);
			}

			return c.json({
				ok: true,
				txHash,
				status: receipt.status,
				gasUsed: receipt.gasUsed.toString(),
				blockNumber: receipt.blockNumber.toString(),
				blockTimestamp: receipt.blockTimestamp,
			} as TransactionReceiptResult);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			return c.json(
				{
					ok: false,
					error: `Failed to fetch transaction receipt: ${errorMessage}`,
					code: "NETWORK_ERROR",
				} as TransactionReceiptResult,
				500,
			);
		}
	})
	// ===== POST Routes =====
	// Gas Estimation
	.post("/estimate-gas", async (c) => {
		const body = await c.req.json<GasEstimateRequest>();

		// Validate addresses
		const fromValidation = validateAddress(body.from, "gasEstimate");
		if (!fromValidation.ok) return c.json(fromValidation.error, 400);

		const toValidation = validateAddress(body.to, "gasEstimate");
		if (!toValidation.ok) return c.json(toValidation.error, 400);

		// Validate chainId (already a number in request body)
		if (!isSupportedChainId(body.chainId) || !isNumericChainId(body.chainId)) {
			return c.json(
				{
					ok: false,
					error: "Invalid or unsupported chain ID",
					code: "INVALID_CHAIN",
				},
				400,
			);
		}

		// Validate value
		const valueValidation = parseBigInt(body.value, "value");
		if (!valueValidation.ok) return c.json(valueValidation.error, 400);

		try {
			// Estimate gas
			const estimate = await estimateGas(c.env, {
				from: fromValidation.address,
				to: toValidation.address,
				value: valueValidation.value,
				chainId: body.chainId,
			});

			// Calculate total gas cost in ETH
			const totalCostWei = estimateGasCost(
				estimate.gasLimit,
				estimate.maxFeePerGas,
			);
			const totalCostEth = formatEther(totalCostWei);

			return c.json({
				ok: true,
				gasLimit: estimate.gasLimit,
				maxFeePerGas: estimate.maxFeePerGas,
				maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
				totalCostEth: totalCostEth,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			return c.json(
				{
					ok: false,
					error: `Gas estimation failed: ${errorMessage}`,
					code: "NETWORK_ERROR",
				},
				500,
			);
		}
	})
	.post("/estimate-gas/erc20", async (c) => {
		const body = await c.req.json<Erc20GasEstimateRequest>();

		// Validate addresses
		const fromValidation = validateAddress(body.from, "gasEstimate");
		if (!fromValidation.ok) return c.json(fromValidation.error, 400);

		const toValidation = validateAddress(body.to, "gasEstimate");
		if (!toValidation.ok) return c.json(toValidation.error, 400);

		const contractValidation = validateAddress(body.contract, "gasEstimate");
		if (!contractValidation.ok) return c.json(contractValidation.error, 400);

		// Validate chainId (already a number in request body)
		if (!isSupportedChainId(body.chainId) || !isNumericChainId(body.chainId)) {
			return c.json(
				{
					ok: false,
					error: "Invalid or unsupported chain ID",
					code: "INVALID_CHAIN",
				},
				400,
			);
		}

		// Validate amount
		const amountValidation = parseBigInt(body.amount, "amount");
		if (!amountValidation.ok) return c.json(amountValidation.error, 400);

		// Estimate gas for ERC20 transfer
		const result = await estimateErc20Transfer(
			c.env,
			fromValidation.address,
			toValidation.address,
			contractValidation.address,
			amountValidation.value.toString(),
			body.chainId,
		);

		if (!result.ok) return c.json(result, 500);
		return c.json(result);
	})
	.post("/estimate-gas/tron", async (c) => {
		const body = await c.req.json<TronGasEstimateRequest>();

		// If contract is empty or null, it's a native TRX transfer
		// Otherwise, it's a TRC20 transfer
		const result =
			!body.contract || body.contract === ""
				? await estimateTrxTransfer(c.env, body.from, body.to, body.amount)
				: await estimateTrc20Transfer(
						c.env,
						body.from,
						body.to,
						body.contract,
						body.amount,
					);

		if (!result.ok) {
			const status = result.code === "NETWORK_ERROR" ? 502 : 400;
			return c.json(result, status);
		}

		return c.json(result);
	})
	// Transaction Broadcasting
	.post("/broadcast-transaction", async (c) => {
		const body = await c.req.json<BroadcastTransactionRequest>();

		// Validate signed transaction format
		if (
			!body.signedTransaction ||
			!body.signedTransaction.startsWith("0x") ||
			body.signedTransaction.length < 10
		) {
			return c.json(
				{
					ok: false,
					error: "Invalid signed transaction format",
					code: "INVALID_TRANSACTION",
				},
				400,
			);
		}

		// Validate chainId (already a number in request body)
		if (!isSupportedChainId(body.chainId) || !isNumericChainId(body.chainId)) {
			return c.json(
				{
					ok: false,
					error: "Invalid or unsupported chain ID",
					code: "INVALID_CHAIN",
				},
				400,
			);
		}

		try {
			// Broadcast the signed transaction
			const txHash = await broadcastTransaction(c.env, {
				signedTransaction: body.signedTransaction,
				chainId: body.chainId,
			});

			return c.json({
				ok: true,
				txHash: txHash,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			return c.json(
				{
					ok: false,
					error: `Failed to broadcast transaction: ${errorMessage}`,
					code: "BROADCAST_FAILED",
				},
				500,
			);
		}
	})
	.post("/broadcast-transaction/tron", async (c) => {
		const body = await c.req.json<{ signedTransaction: string }>();

		if (!body.signedTransaction) {
			return c.json(
				{
					ok: false,
					error: "Missing signed transaction",
					code: "INVALID_TRANSACTION",
				},
				400,
			);
		}

		const result = await broadcastTronTransaction(
			c.env,
			body.signedTransaction,
		);

		if (!result.ok) {
			const status = result.code === "INVALID_TRANSACTION" ? 400 : 502;
			return c.json(result, status);
		}

		return c.json(result);
	});

export default app;
