/**
 * ERC20 token interaction utilities.
 * Handles balance fetching and transfer gas estimation for ERC20 tokens.
 */

import type { Erc20BalanceResult, GasEstimateResult } from "@shared/types";
import { encodeFunctionData, formatEther } from "viem";
import { getPublicClient } from "./rpc";

const ERC20_ABI = [
	{
		inputs: [{ name: "account", type: "address" }],
		name: "balanceOf",
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "decimals",
		outputs: [{ name: "", type: "uint8" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "symbol",
		outputs: [{ name: "", type: "string" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ name: "to", type: "address" },
			{ name: "amount", type: "uint256" },
		],
		name: "transfer",
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "nonpayable",
		type: "function",
	},
] as const;

/**
 * Fetch ERC20 token balance for an address.
 */
export async function fetchErc20Balance(
	env: Env,
	address: string,
	contract: string,
	chainId: number,
): Promise<Erc20BalanceResult> {
	try {
		const client = getPublicClient(env, chainId);

		// Parallel calls: balanceOf, decimals, symbol
		const [balance, decimals, symbol] = await Promise.all([
			client.readContract({
				address: contract as `0x${string}`,
				abi: ERC20_ABI,
				functionName: "balanceOf",
				args: [address as `0x${string}`],
			}),
			client.readContract({
				address: contract as `0x${string}`,
				abi: ERC20_ABI,
				functionName: "decimals",
			}),
			client.readContract({
				address: contract as `0x${string}`,
				abi: ERC20_ABI,
				functionName: "symbol",
			}),
		]);

		// Format: convert raw balance to human-readable
		const divisor = BigInt(10 ** decimals);
		const wholeUnits = balance / divisor;
		const remainder = balance % divisor;
		const remainderStr = remainder.toString().padStart(decimals, "0");
		// Trim trailing zeros
		const trimmedRemainder = remainderStr.replace(/0+$/, "");
		const balanceFormatted = trimmedRemainder
			? `${wholeUnits}.${trimmedRemainder}`
			: wholeUnits.toString();

		return {
			ok: true,
			address,
			contract,
			symbol,
			decimals,
			balanceRaw: balance.toString(),
			balanceFormatted,
			timestamp: Date.now(),
		};
	} catch (error) {
		return {
			ok: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to fetch ERC20 balance",
			code: "API_ERROR",
		};
	}
}

/**
 * Estimate gas for an ERC20 transfer.
 */
export async function estimateErc20Transfer(
	env: Env,
	from: string,
	to: string,
	contract: string,
	amountRaw: string,
	chainId: number,
): Promise<GasEstimateResult> {
	try {
		const client = getPublicClient(env, chainId);

		// ERC20 transfer encoding: transfer(address to, uint256 amount)
		const data = encodeFunctionData({
			abi: ERC20_ABI,
			functionName: "transfer",
			args: [to as `0x${string}`, BigInt(amountRaw)],
		});

		// Estimate gas
		const gasEstimate = await client.estimateGas({
			account: from as `0x${string}`,
			to: contract as `0x${string}`,
			data,
		});

		// Get current fee data (EIP-1559)
		const feeData = await client.estimateFeesPerGas();

		const gasLimit = (gasEstimate * 2n).toString(); // Safety margin
		const maxFeePerGas = feeData.maxFeePerGas?.toString() ?? "0";
		const maxPriorityFeePerGas =
			feeData.maxPriorityFeePerGas?.toString() ?? "0";

		// Calculate total cost in ETH
		const totalCostWei = BigInt(gasLimit) * BigInt(maxFeePerGas);
		const totalCostEth = formatEther(totalCostWei);

		return {
			ok: true,
			gasLimit,
			maxFeePerGas,
			maxPriorityFeePerGas,
			totalCostEth,
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Gas estimation failed",
			code: "NETWORK_ERROR",
		};
	}
}
