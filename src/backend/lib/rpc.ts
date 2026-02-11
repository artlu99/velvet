/**
 * RPC client for interacting with Ethereum and Base networks.
 * Uses viem for type-safe blockchain interactions.
 */

import type { BalanceResult, EvmChainId } from "@shared/types";
import { createPublicClient, formatEther, http } from "viem";
import { base, mainnet } from "viem/chains";

/**
 * Get the RPC URL for a given chain ID.
 */
export function getRpcUrl(env: Env, chainId: EvmChainId): string {
	switch (chainId) {
		case 1:
			return env.ETHEREUM_RPC_URL;
		case 8453:
			return env.BASE_RPC_URL;
		default:
			throw new Error(`Unsupported chain ID: ${chainId}`);
	}
}

/**
 * Get a public client for the given chain ID.
 * Includes CORS headers for compatibility with restricted RPC providers.
 */
export function getPublicClient(env: Env, chainId: EvmChainId) {
	const rpcUrl = getRpcUrl(env, chainId);
	return createPublicClient({
		chain: chainId === 8453 ? base : mainnet,
		transport: http(rpcUrl, {
			fetchOptions: {
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
			},
		}),
	});
}

/**
 * Estimate gas for a transaction.
 * Returns EIP-1559 fee parameters.
 */
export async function estimateGas(
	env: Env,
	params: {
		from: string;
		to: string;
		value: bigint;
		chainId: EvmChainId;
	},
) {
	const client = getPublicClient(env, params.chainId);

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
export async function broadcastTransaction(
	env: Env,
	params: {
		signedTransaction: string;
		chainId: EvmChainId;
	},
): Promise<`0x${string}`> {
	const client = getPublicClient(env, params.chainId);
	const hash = await client.sendRawTransaction({
		serializedTransaction: params.signedTransaction as `0x${string}`,
	});
	return hash;
}

/**
 * Get the native balance for an address.
 */
export async function getNativeBalance(
	env: Env,
	address: string,
	chainId: EvmChainId,
): Promise<BalanceResult> {
	const client = getPublicClient(env, chainId);
	const nativeBalance = await client.getBalance({
		address: address as `0x${string}`,
	});
	return {
		ok: true,
		address,
		chainId,
		balanceWei: nativeBalance.toString(),
		balanceEth: formatEther(nativeBalance),
		timestamp: Date.now(),
	};
}

/**
 * Get the transaction count (nonce) for an address.
 */
export async function getTransactionCount(
	env: Env,
	address: string,
	chainId: EvmChainId,
): Promise<number> {
	const client = getPublicClient(env, chainId);
	const count = await client.getTransactionCount({
		address: address as `0x${string}`,
	});
	return count;
}

/**
 * Get transaction receipt for a transaction hash.
 * Returns null if transaction is not found or not yet confirmed.
 */
export async function getTransactionReceipt(
	env: Env,
	txHash: `0x${string}`,
	chainId: EvmChainId,
): Promise<{
	status: "success" | "reverted";
	gasUsed: bigint;
	blockNumber: bigint;
	blockTimestamp: number | null;
} | null> {
	const client = getPublicClient(env, chainId);

	try {
		const receipt = await client.getTransactionReceipt({ hash: txHash });

		// Get block timestamp
		let blockTimestamp: number | null = null;
		try {
			const block = await client.getBlock({ blockNumber: receipt.blockNumber });
			blockTimestamp = Number(block.timestamp);
		} catch {
			// Block timestamp fetch failed, continue without it
		}

		return {
			status: receipt.status === "success" ? "success" : "reverted",
			gasUsed: receipt.gasUsed,
			blockNumber: receipt.blockNumber,
			blockTimestamp,
		};
	} catch (error) {
		// Transaction not found or not yet confirmed
		if (
			error instanceof Error &&
			(error.message.includes("not found") ||
				error.message.includes("TransactionNotFound"))
		) {
			return null;
		}
		throw error;
	}
}
