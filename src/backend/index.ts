import type {
	AppName,
	BalanceError,
	BroadcastTransactionError,
	BroadcastTransactionRequest,
	GasEstimateError,
	GasEstimateRequest,
	TransactionCountError,
} from "@shared/types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import invariant from "tiny-invariant";
import { formatEther, isAddress } from "viem";
import {
	fetchBalance,
	isSupportedChainId,
	isValidAddress,
	parseChainId,
} from "./lib/balance";
import {
	broadcastTransaction,
	estimateGas,
	estimateGasCost,
	getTransactionCount,
} from "./lib/rpc";

const app = new Hono<{ Bindings: Cloudflare.Env }>().basePath("/api");

const BALANCE_CACHE_TTL_SECONDS = 60 * 5;

app
	.use(cors())
	.use(secureHeaders())
	.use(csrf())
	.get("/name", (c) => {
		invariant(c.env.NAME, "NAME is not set");
		const ret: AppName = { name: c.env.NAME };
		return c.json(ret);
	})
	.get("/balance/:address", async (c) => {
		const address = c.req.param("address");
		const chainIdParam = c.req.query("chainId");

		// Validate address
		if (!isValidAddress(address)) {
			const error: BalanceError = {
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			};
			return c.json(error, 400);
		}

		// Validate chainId
		const chainId = parseChainId(chainIdParam);
		if (chainId === null || !isSupportedChainId(chainId)) {
			const error: BalanceError = {
				ok: false,
				error:
					"Invalid or unsupported chain ID. Supported: 1 (mainnet), 8453 (Base)",
				code: "INVALID_CHAIN",
			};
			return c.json(error, 400);
		}

		const normalizedAddress = address.toLowerCase();
		const cacheKey = `balance:${chainId}:${normalizedAddress}`;

		const cached = await c.env.BALANCE_CACHE.get(cacheKey, "json");
		if (cached) {
			return c.json(cached);
		}

		// Fetch balance
		invariant(c.env.ETHERSCAN_API_KEY, "ETHERSCAN_API_KEY is not set");
		const result = await fetchBalance(
			address,
			chainId,
			c.env.ETHERSCAN_API_KEY,
		);

		if (!result.ok) {
			const status = result.code === "RATE_LIMITED" ? 429 : 502;
			return c.json(result, status);
		}

		await c.env.BALANCE_CACHE.put(cacheKey, JSON.stringify(result), {
			expirationTtl: BALANCE_CACHE_TTL_SECONDS,
		});

		return c.json(result);
	})
	.get("/transaction-count/:address", async (c) => {
		const address = c.req.param("address");
		const chainIdParam = c.req.query("chainId");

		// Validate address
		if (!isValidAddress(address)) {
			const error: TransactionCountError = {
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			};
			return c.json(error, 400);
		}

		// Validate chainId
		const chainId = parseChainId(chainIdParam);
		if (chainId === null || !isSupportedChainId(chainId)) {
			const error: TransactionCountError = {
				ok: false,
				error: "Invalid or unsupported chain ID",
				code: "INVALID_CHAIN",
			};
			return c.json(error, 400);
		}

		try {
			const nonce = await getTransactionCount(address, chainId);
			return c.json({
				ok: true,
				nonce,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const err: TransactionCountError = {
				ok: false,
				error: `Failed to fetch transaction count: ${errorMessage}`,
				code: "NETWORK_ERROR",
			};
			return c.json(err, 500);
		}
	})
	.post("/estimate-gas", async (c) => {
		const body = await c.req.json<GasEstimateRequest>();

		// Validate addresses
		if (!isAddress(body.from)) {
			const error: GasEstimateError = {
				ok: false,
				error: "Invalid from address format",
				code: "INVALID_ADDRESS",
			};
			return c.json(error, 400);
		}

		if (!isAddress(body.to)) {
			const error: GasEstimateError = {
				ok: false,
				error: "Invalid to address format",
				code: "INVALID_ADDRESS",
			};
			return c.json(error, 400);
		}

		// Validate chainId
		if (!isSupportedChainId(body.chainId)) {
			const error: GasEstimateError = {
				ok: false,
				error: "Invalid or unsupported chain ID",
				code: "NETWORK_ERROR",
			};
			return c.json(error, 400);
		}

		// Validate value
		const value = BigInt(body.value);
		if (value < 0) {
			const error: GasEstimateError = {
				ok: false,
				error: "Value must be non-negative",
				code: "NETWORK_ERROR",
			};
			return c.json(error, 400);
		}

		try {
			// Estimate gas
			const estimate = await estimateGas({
				from: body.from,
				to: body.to,
				value,
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
			const err: GasEstimateError = {
				ok: false,
				error: `Gas estimation failed: ${errorMessage}`,
				code: "NETWORK_ERROR",
			};
			return c.json(err, 500);
		}
	})
	.post("/broadcast-transaction", async (c) => {
		const body = await c.req.json<BroadcastTransactionRequest>();

		// Validate signed transaction format
		if (
			!body.signedTransaction ||
			!body.signedTransaction.startsWith("0x") ||
			body.signedTransaction.length < 10
		) {
			const error: BroadcastTransactionError = {
				ok: false,
				error: "Invalid signed transaction format",
				code: "INVALID_TRANSACTION",
			};
			return c.json(error, 400);
		}

		// Validate chainId
		if (!isSupportedChainId(body.chainId)) {
			const error: BroadcastTransactionError = {
				ok: false,
				error: "Invalid or unsupported chain ID",
				code: "INVALID_TRANSACTION",
			};
			return c.json(error, 400);
		}

		try {
			// Broadcast the signed transaction
			const txHash = await broadcastTransaction({
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
			const err: BroadcastTransactionError = {
				ok: false,
				error: `Failed to broadcast transaction: ${errorMessage}`,
				code: "BROADCAST_FAILED",
			};
			return c.json(err, 500);
		}
	});

export default app;
