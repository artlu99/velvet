/**
 * ENS (Ethereum Name Service) reverse lookup utilities.
 * Handles resolving ENS names from Ethereum addresses on mainnet.
 */

import type { EnsNameResult } from "@shared/types";
import { getAddress, isAddress } from "viem";
import { getPublicClient } from "./rpc";

/**
 * Fetch ENS name for an address via reverse lookup.
 * Hardcoded to Ethereum mainnet (chainId 1).
 */
export async function fetchEnsName(
	env: Env,
	address: string,
): Promise<EnsNameResult> {
	try {
		// Validate address format
		if (!isAddress(address)) {
			return {
				ok: false,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS",
			};
		}

		// Normalize address to checksum format
		const normalizedAddress = getAddress(address);

		// Get mainnet client (hardcoded to chainId 1)
		const client = getPublicClient(env, 1);

		// Reverse lookup: get ENS name from address
		const ensName = await client.getEnsName({
			address: normalizedAddress,
		});

		return {
			ok: true,
			address: normalizedAddress,
			ensName,
			timestamp: Date.now(),
		};
	} catch (error) {
		return {
			ok: false,
			error:
				error instanceof Error ? error.message : "Failed to fetch ENS name",
			code: "NETWORK_ERROR",
		};
	}
}
