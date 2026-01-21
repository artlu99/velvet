import type { AppName, BalanceError } from "@shared/types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import invariant from "tiny-invariant";
import {
	fetchBalance,
	isSupportedChainId,
	isValidAddress,
	parseChainId,
} from "./lib/balance";

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
	});

export default app;
