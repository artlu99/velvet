import type {
	AppName,
	BalanceError,
	BroadcastTransactionError,
	BroadcastTransactionRequest,
	EnsNameError,
	Erc20BalanceError,
	Erc20GasEstimateRequest,
	GasEstimateError,
	GasEstimateRequest,
	PricesResult,
	TransactionCountError,
	TronBroadcastError,
	TronGasEstimateRequest,
} from "@shared/types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import invariant from "tiny-invariant";
import { formatEther, getAddress, isAddress } from "viem";
import { fetchBalance, isSupportedChainId, parseChainId } from "./lib/balance";
import { fetchPrices } from "./lib/coingecko";
import { fetchEnsName } from "./lib/ens";
import { estimateErc20Transfer, fetchErc20Balance } from "./lib/erc20";
import {
	broadcastTransaction,
	estimateGas,
	estimateGasCost,
	getTransactionCount,
} from "./lib/rpc";
import {
	broadcastTronTransaction,
	estimateTrc20Transfer,
	estimateTrxTransfer,
	getTrc20Balance,
	getTronBalance,
} from "./lib/tron/rpc";

const app = new Hono<{ Bindings: Cloudflare.Env }>().basePath("/api");

const BALANCE_CACHE_TTL_SECONDS = 60; // 1 minute
const ENS_CACHE_TTL_SECONDS = 60 * 30; // 30 minutes

function isNumericChainId(chainId: string | number): chainId is number {
	return (
		typeof chainId === "number" ||
		(typeof chainId === "string" && chainId !== "tron")
	);
}

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
		const cacheBust = c.req.query("cacheBust");
		const bypassCache = cacheBust !== undefined;

		// Validate address
		if (!isAddress(address)) {
			const error: BalanceError = {
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			};
			return c.json(error, 400);
		}

		// Validate chainId
		const chainId = parseChainId(chainIdParam);
		if (
			chainId === null ||
			!isSupportedChainId(chainId) ||
			!isNumericChainId(chainId)
		) {
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

		if (!bypassCache) {
			const cached = await c.env.BALANCE_CACHE.get(cacheKey, "json");
			if (cached) {
				c.header("x-balance-cache", "hit");
				return c.json(cached);
			}
			c.header("x-balance-cache", "miss");
		} else {
			c.header("x-balance-cache", "bypass");
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

		if (!bypassCache) {
			await c.env.BALANCE_CACHE.put(cacheKey, JSON.stringify(result), {
				expirationTtl: BALANCE_CACHE_TTL_SECONDS,
			});
		}

		return c.json(result);
	})
	.get("/balance/erc20/:address/:contract", async (c) => {
		const address = c.req.param("address");
		const contract = c.req.param("contract");
		const chainIdParam = c.req.query("chainId");
		const cacheBust = c.req.query("cacheBust");
		const bypassCache = cacheBust !== undefined;

		// Validate inputs
		if (!isAddress(address) || !isAddress(contract)) {
			const error: Erc20BalanceError = {
				ok: false,
				error: "Invalid address",
				code: "INVALID_ADDRESS",
			};
			return c.json(error, 400);
		}

		const chainId = parseChainId(chainIdParam);
		if (
			chainId === null ||
			!isSupportedChainId(chainId) ||
			!isNumericChainId(chainId)
		) {
			const error: Erc20BalanceError = {
				ok: false,
				error: "Invalid chain",
				code: "INVALID_CHAIN",
			};
			return c.json(error, 400);
		}

		const normalizedAddress = address.toLowerCase();
		const normalizedContract = contract.toLowerCase();
		const cacheKey = `erc20Balance:${chainId}:${normalizedAddress}:${normalizedContract}`;

		if (!bypassCache) {
			const cached = await c.env.BALANCE_CACHE.get(cacheKey, "json");
			if (cached) {
				c.header("x-balance-cache", "hit");
				return c.json(cached);
			}
			c.header("x-balance-cache", "miss");
		} else {
			c.header("x-balance-cache", "bypass");
		}

		// Fetch ERC20 balance via RPC
		const result = await fetchErc20Balance(c.env, address, contract, chainId);

		if (!result.ok) {
			return c.json(result, 502);
		}

		if (!bypassCache) {
			await c.env.BALANCE_CACHE.put(cacheKey, JSON.stringify(result), {
				expirationTtl: BALANCE_CACHE_TTL_SECONDS,
			});
		}

		return c.json(result);
	})
	.get("/ens/:address", async (c) => {
		const address = c.req.param("address");
		const cacheBust = c.req.query("cacheBust");
		const bypassCache = cacheBust !== undefined;

		// Validate address
		if (!isAddress(address)) {
			const error: EnsNameError = {
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			};
			return c.json(error, 400);
		}

		// Normalize to checksummed format for consistency
		const normalizedAddress = getAddress(address);
		const cacheKey = `ens:${normalizedAddress.toLowerCase()}`;

		if (!bypassCache) {
			const cached = await c.env.BALANCE_CACHE.get(cacheKey, "json");
			if (cached) {
				c.header("x-ens-cache", "hit");
				return c.json(cached);
			}
			c.header("x-ens-cache", "miss");
		} else {
			c.header("x-ens-cache", "bypass");
		}

		// Fetch ENS name (pass normalized address)
		const result = await fetchEnsName(c.env, normalizedAddress);

		if (!result.ok) {
			const status = result.code === "INVALID_ADDRESS" ? 400 : 502;
			return c.json(result, status);
		}

		if (!bypassCache) {
			await c.env.BALANCE_CACHE.put(cacheKey, JSON.stringify(result), {
				expirationTtl: ENS_CACHE_TTL_SECONDS,
			});
		}

		return c.json(result);
	})
	.get("/transaction-count/:address", async (c) => {
		const address = c.req.param("address");
		const chainIdParam = c.req.query("chainId");

		// Validate address
		if (!isAddress(address)) {
			const error: TransactionCountError = {
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			};
			return c.json(error, 400);
		}

		// Validate chainId
		const chainId = parseChainId(chainIdParam);
		if (
			chainId === null ||
			!isSupportedChainId(chainId) ||
			!isNumericChainId(chainId)
		) {
			const error: TransactionCountError = {
				ok: false,
				error: "Invalid or unsupported chain ID",
				code: "INVALID_CHAIN",
			};
			return c.json(error, 400);
		}

		try {
			const nonce = await getTransactionCount(c.env, address, chainId);
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
		if (!isSupportedChainId(body.chainId) || !isNumericChainId(body.chainId)) {
			const error: GasEstimateError = {
				ok: false,
				error: "Invalid or unsupported chain ID",
				code: "NETWORK_ERROR",
			};
			return c.json(error, 400);
		}

		// Validate value
		let value: bigint;
		try {
			value = BigInt(body.value);
		} catch {
			const error: GasEstimateError = {
				ok: false,
				error: "Invalid value format",
				code: "NETWORK_ERROR",
			};
			return c.json(error, 400);
		}

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
			const estimate = await estimateGas(c.env, {
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
		if (!isSupportedChainId(body.chainId) || !isNumericChainId(body.chainId)) {
			const error: BroadcastTransactionError = {
				ok: false,
				error: "Invalid or unsupported chain ID",
				code: "INVALID_TRANSACTION",
			};
			return c.json(error, 400);
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
			const err: BroadcastTransactionError = {
				ok: false,
				error: `Failed to broadcast transaction: ${errorMessage}`,
				code: "BROADCAST_FAILED",
			};
			return c.json(err, 500);
		}
	})
	.post("/estimate-gas/erc20", async (c) => {
		const body = await c.req.json<Erc20GasEstimateRequest>();

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

		if (!isAddress(body.contract)) {
			const error: GasEstimateError = {
				ok: false,
				error: "Invalid contract address format",
				code: "INVALID_ADDRESS",
			};
			return c.json(error, 400);
		}

		// Validate chainId
		if (!isSupportedChainId(body.chainId) || !isNumericChainId(body.chainId)) {
			const error: GasEstimateError = {
				ok: false,
				error: "Invalid or unsupported chain ID",
				code: "NETWORK_ERROR",
			};
			return c.json(error, 400);
		}

		// Validate amount
		let amount: bigint;
		try {
			amount = BigInt(body.amount);
		} catch {
			const error: GasEstimateError = {
				ok: false,
				error: "Invalid amount format",
				code: "NETWORK_ERROR",
			};
			return c.json(error, 400);
		}

		if (amount < 0) {
			const error: GasEstimateError = {
				ok: false,
				error: "Amount must be non-negative",
				code: "NETWORK_ERROR",
			};
			return c.json(error, 400);
		}

		// Estimate gas for ERC20 transfer
		const result = await estimateErc20Transfer(
			c.env,
			body.from,
			body.to,
			body.contract,
			body.amount,
			body.chainId,
		);

		if (!result.ok) {
			return c.json(result, 500);
		}

		return c.json(result);
	})
	.get("/prices", async (c) => {
		const idsParam = c.req.query("ids");
		const cacheBust = c.req.query("cacheBust");
		const bypassCache = cacheBust !== undefined;

		// Default to common tokens if not specified
		const coinIds = idsParam
			? idsParam.split(",").map((id) => id.trim())
			: ["ethereum", "tron", "usd-coin", "tether"];

		// Sort IDs to normalize cache key
		const sortedIds = [...coinIds].sort().join(",");
		const cacheKey = `prices:${sortedIds}`;

		if (!bypassCache) {
			const cached = await c.env.BALANCE_CACHE.get(cacheKey, "json");
			if (cached) {
				c.header("x-prices-cache", "hit");
				return c.json(cached);
			}
			c.header("x-prices-cache", "miss");
		} else {
			c.header("x-prices-cache", "bypass");
		}

		try {
			// Fetch prices from CoinGecko
			invariant(
				c.env.COINGECKO_API_KEY,
				"COINGECKO_API_KEY is not set in environment",
			);
			const prices = await fetchPrices({
				env: c.env,
				coinIds,
			});

			const result: PricesResult = {
				ok: true,
				prices,
				timestamp: Date.now(),
			};

			if (!bypassCache) {
				await c.env.BALANCE_CACHE.put(cacheKey, JSON.stringify(result), {
					expirationTtl: BALANCE_CACHE_TTL_SECONDS,
				});
			}

			return c.json(result);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const errorResult: PricesResult = {
				ok: false,
				error: errorMessage,
				code: errorMessage.includes("rate limit")
					? "RATE_LIMITED"
					: "API_ERROR",
			};
			const status =
				errorMessage.includes("rate limit") || errorMessage.includes("429")
					? 429
					: 502;
			return c.json(errorResult, status);
		}
	})
	.get("/balance/tron/:address", async (c) => {
		const address = c.req.param("address");
		const cacheBust = c.req.query("cacheBust");
		const bypassCache = cacheBust !== undefined;

		const result = await getTronBalance(c.env, address);

		if (!result.ok) {
			const status = result.code === "INVALID_TRON_ADDRESS" ? 400 : 502;
			return c.json(result, status);
		}

		const cacheKey = `tronBalance:${address}`;

		if (!bypassCache) {
			await c.env.BALANCE_CACHE.put(cacheKey, JSON.stringify(result), {
				expirationTtl: BALANCE_CACHE_TTL_SECONDS,
			});
		}

		return c.json(result);
	})
	.get("/balance/trc20/:address/:contract", async (c) => {
		const address = c.req.param("address");
		const contract = c.req.param("contract");
		const cacheBust = c.req.query("cacheBust");
		const bypassCache = cacheBust !== undefined;

		const result = await getTrc20Balance(c.env, address, contract);

		if (!result.ok) {
			const status =
				result.code === "INVALID_TRON_ADDRESS" ||
				result.code === "INVALID_CONTRACT"
					? 400
					: 502;
			return c.json(result, status);
		}

		const cacheKey = `trc20Balance:${address}:${contract}`;

		if (!bypassCache) {
			await c.env.BALANCE_CACHE.put(cacheKey, JSON.stringify(result), {
				expirationTtl: BALANCE_CACHE_TTL_SECONDS,
			});
		}

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
	.post("/broadcast-transaction/tron", async (c) => {
		const body = await c.req.json<{ signedTransaction: string }>();

		if (!body.signedTransaction) {
			const error: TronBroadcastError = {
				ok: false,
				error: "Missing signed transaction",
				code: "INVALID_TRANSACTION",
			};
			return c.json(error, 400);
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
