/**
 * RPC client for interacting with Ethereum and Base networks.
 * Uses viem for type-safe blockchain interactions.
 */

import { createPublicClient, http } from "viem";
import { base, mainnet } from "viem/chains";

// Cloudflare EVM RPC endpoints
const ETHEREUM_RPC_URL = "https://eth.merkle.io";
const BASE_RPC_URL = "https://mainnet.base.org";

/**
 * Get the RPC URL for a given chain ID.
 */
export function getRpcUrl(chainId: number): string {
	switch (chainId) {
		case 1:
			return ETHEREUM_RPC_URL;
		case 8453:
			return BASE_RPC_URL;
		default:
			throw new Error(`Unsupported chain ID: ${chainId}`);
	}
}

/**
 * Get a public client for the given chain ID.
 */
export function getPublicClient(chainId: number) {
	const rpcUrl = getRpcUrl(chainId);
	return createPublicClient({
		chain: chainId === 8453 ? base : mainnet,
		transport: http(rpcUrl),
	});
}

/**
 * Estimate gas for a transaction.
 * Returns EIP-1559 fee parameters.
 */
export async function estimateGas(params: {
	from: string;
	to: string;
	value: bigint;
	chainId: number;
}) {
	const client = getPublicClient(params.chainId);

	// Estimate gas limit
	const gasLimit = await client.estimateGas({
		account: params.from as `0x${string}`,
		to: params.to as `0x${string}`,
		value: params.value,
	});

	// Get current fee data (EIP-1559)
	const feeData = await client.estimateFeesPerGas();

	return {
		gasLimit: gasLimit.toString(),
		maxFeePerGas: feeData.maxFeePerGas?.toString() ?? "0",
		maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() ?? "0",
	};
}

/**
 * Estimate the total gas cost in wei.
 */
export function estimateGasCost(
	gasLimit: string,
	maxFeePerGas: string,
): bigint {
	return BigInt(gasLimit) * BigInt(maxFeePerGas);
}

/**
 * Broadcast a signed transaction to the network.
 */
export async function broadcastTransaction(params: {
	signedTransaction: string;
	chainId: number;
}): Promise<`0x${string}`> {
	const client = getPublicClient(params.chainId);
	const hash = await client.sendRawTransaction({
		serializedTransaction: params.signedTransaction as `0x${string}`,
	});
	return hash;
}

/**
 * Get the transaction count (nonce) for an address.
 */
export async function getTransactionCount(
	address: string,
	chainId: number,
): Promise<number> {
	const client = getPublicClient(chainId);
	const count = await client.getTransactionCount({
		address: address as `0x${string}`,
	});
	return count;
}
