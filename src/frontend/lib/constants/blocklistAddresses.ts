/**
 * App-provided blocklist of known scam/malicious addresses
 *
 * Sources: Blockchain security reports, community feeds
 */

import { getAddress } from "viem";
import type { EvoluInstance } from "~/lib/evolu";

export interface BlocklistEntry {
	address: string;
	reason: string;
}

// Curated list of known scam/malicious addresses
// This is a starter list - users can add their own
export const APP_BLOCKLIST: Array<BlocklistEntry> = [
	// Token contract addresses (common mistake to send funds to the contract itself)
	{
		address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		reason: "USDC token contract on Ethereum mainnet - not a recipient address",
	},
	{
		address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		reason: "USDC token contract on Base - not a recipient address",
	},
];

/**
 * Query factory for checking if a blocklist entry exists
 */
const createBlocklistExistsQuery = (
	evolu: EvoluInstance,
	address: string,
	source: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("blocklist")
			.selectAll()
			.where("address", "=", getAddress(address) as never)
			.where("source", "=", source as never),
	);

/**
 * Seed app-provided blocklist on Evolu initialization
 */
export async function seedAppBlocklist(evolu: EvoluInstance): Promise<void> {
	for (const entry of APP_BLOCKLIST) {
		const query = createBlocklistExistsQuery(
			evolu,
			getAddress(entry.address),
			"app",
		);
		const results = await evolu.loadQuery(query);

		// Only add if doesn't already exist
		if (results.length === 0) {
			evolu.insert("blocklist", {
				address: getAddress(entry.address),
				reason: entry.reason,
				source: "app",
				addedAt: new Date().toISOString(),
			});
		}
	}
}
