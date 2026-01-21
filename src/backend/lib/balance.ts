import type { BalanceResult, SupportedChainId } from "@shared/types";
import { sleep } from "radash";
import { formatEther, isAddress } from "viem";

// Etherscan API V2 - unified endpoint for all chains
const ETHERSCAN_API_V2_URL = "https://api.etherscan.io/v2/api";

const SUPPORTED_CHAIN_IDS: SupportedChainId[] = [1, 8453];

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

export function isValidAddress(address: string): boolean {
	return isAddress(address);
}

export function isSupportedChainId(
	chainId: number,
): chainId is SupportedChainId {
	return SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId);
}

export function parseChainId(value: string | undefined): number | null {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
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
	const url = buildBalanceUrl(address, chainId, apiKey);

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
