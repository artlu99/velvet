import type { SupportedChainId } from "@shared/types";
import type { CoinGeckoToken } from "~/providers/tokenStore";

/**
 * Get decimals for a token on a specific chain.
 */
export function getTokenDecimals(
	token: CoinGeckoToken,
	chainId: SupportedChainId,
): number {
	const platformId = chainId === 1 ? "ethereum" : "base";
	const detail = token.detail_platforms[platformId];
	return detail?.decimal_place ?? 18; // Default to 18 if not found
}

/**
 * Get contract address for a token on a specific chain.
 * Returns "0x0" for native tokens.
 */
export function getTokenAddress(
	token: CoinGeckoToken,
	chainId: SupportedChainId,
): string {
	const platformId = chainId === 1 ? "ethereum" : "base";
	const address = token.platforms[platformId];
	return address || "0x0";
}

/**
 * Check if token is native (no contract address) on a specific chain.
 */
export function isNativeToken(
	token: CoinGeckoToken,
	chainId: SupportedChainId,
): boolean {
	const address = getTokenAddress(token, chainId);
	return address === "0x0" || address === "";
}
