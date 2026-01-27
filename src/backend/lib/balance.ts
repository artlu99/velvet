import type { BalanceResult, SupportedChainId } from "@shared/types";
import { sleep } from "radash";
import { formatEther, getAddress } from "viem";

// Etherscan API V2 - unified endpoint for all chains
const ETHERSCAN_API_V2_URL = "https://api.etherscan.io/v2/api";

const SUPPORTED_CHAIN_IDS: SupportedChainId[] = [1, 8453, "tron"];

// Rate limiting: 4 calls/sec (250ms interval) for safety margin on 5 calls/sec limit
const MIN_INTERVAL_MS = 250;
let lastCallTime = 0;

interface EtherscanBalanceResponse {
	status: "0" | "1";
	message: string;
	result: string;
}

async function rateLimitedFetch(url: string): Promise<Response> {
	const now = Date.now();
	const elapsed = now - lastCallTime;

	if (elapsed < MIN_INTERVAL_MS) {
		await sleep(MIN_INTERVAL_MS - elapsed);
	}

	lastCallTime = Date.now();
	return fetch(url);
}

export function isSupportedChainId(
	chainId: string | number,
): chainId is SupportedChainId {
	return SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId);
}

export function parseChainId(
	value: string | number | null | undefined,
): SupportedChainId | null {
	if (value === null || value === undefined) return null;
	if (value === "tron") return "tron";
	const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
	if (parsed === 1 || parsed === 8453) return parsed;
	return null;
}

function buildBalanceUrl(
	address: string,
	chainId: SupportedChainId,
	apiKey: string,
): string {
	return `${ETHERSCAN_API_V2_URL}?${new URLSearchParams({
		chainid: chainId.toString(),
		module: "account",
		action: "balance",
		address,
		tag: "latest",
		apikey: apiKey,
	}).toString()}`;
}

export async function fetchBalance(
	address: string,
	chainId: SupportedChainId,
	apiKey: string,
): Promise<BalanceResult> {
	const normalizedAddress = getAddress(address);
	const url = buildBalanceUrl(normalizedAddress, chainId, apiKey);

	const response = await rateLimitedFetch(url);

	if (!response.ok) {
		if (response.status === 429) {
			return {
				ok: false,
				error: "Rate limited by Etherscan API",
				code: "RATE_LIMITED",
			};
		}
		return {
			ok: false,
			error: `Etherscan API returned ${response.status}`,
			code: "API_ERROR",
		};
	}

	const data: EtherscanBalanceResponse = await response.json();

	if (data.status === "0") {
		if (data.result.toLowerCase().includes("rate limit")) {
			return {
				ok: false,
				error: "Rate limited by Etherscan API",
				code: "RATE_LIMITED",
			};
		}
		return {
			ok: false,
			error: data.message || data.result || "Etherscan API error",
			code: "API_ERROR",
		};
	}

	const balanceWei = data.result;
	const balanceEth = formatEther(BigInt(balanceWei));

	return {
		ok: true,
		address,
		chainId,
		balanceWei,
		balanceEth,
		timestamp: Date.now(),
	};
}
