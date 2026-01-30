/**
 * Blocklist queries and operations
 *
 * Manages app-provided and user-customized address blocklists
 */

import { getAddress } from "viem";

export interface BlocklistEntry {
	address: string;
	reason: string;
}

export const BLOCKLIST: BlocklistEntry[] = [
	{
		address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		reason: "mainnet USDC",
	},
	{
		address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		reason: "Base USDC",
	},
];

/**
 * Check if an address is blocklisted
 */
export async function isAddressBlocklisted(address: string): Promise<boolean> {
	return BLOCKLIST.some((a) => getAddress(a.address) === getAddress(address));
}

/**
 * Get all active blocklist entries
 */
export async function getActiveBlocklist(): Promise<
	{ address: `0x${string}` }[]
> {
	return BLOCKLIST.map((a) => ({
		address: getAddress(a.address),
	}));
}

export async function getBlocklistReason(
	address: string,
): Promise<string | null> {
	return (
		BLOCKLIST.find((a) => getAddress(a.address) === getAddress(address))
			?.reason ?? null
	);
}
