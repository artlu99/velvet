/**
 * Transaction utility functions for the frontend.
 * Handles ETH/wei conversions and gas calculations.
 */

import { encodeFunctionData, formatEther } from "viem";

/**
 * Convert human-readable amount to smallest unit (token-agnostic)
 * @param amount - Human-readable amount (e.g., "100.5" USDC, "1.5" ETH)
 * @param decimals - Number of decimals for the token (6 for USDC, 18 for ETH)
 * @returns Raw amount in smallest unit as string
 */
export function amountToRaw(amount: string, decimals: number): string {
	try {
		const multiplier = BigInt(10 ** decimals);
		const [whole, frac = ""] = amount.split(".");

		// Pad or truncate fractional part to match decimals
		const paddedFrac = frac.padEnd(decimals, "0").slice(0, decimals);

		return (BigInt(whole) * multiplier + BigInt(paddedFrac || "0")).toString();
	} catch {
		throw new Error(`Invalid amount: ${amount}`);
	}
}

/**
 * Convert smallest unit to human-readable amount (token-agnostic)
 * @param raw - Raw amount in smallest unit
 * @param decimals - Number of decimals for the token
 * @returns Human-readable amount (e.g., "100.5" USDC)
 */
export function rawToAmount(raw: string, decimals: number): string {
	try {
		const divisor = BigInt(10 ** decimals);
		const value = BigInt(raw);

		const whole = (value / divisor).toString();
		const remainder = (value % divisor).toString().padStart(decimals, "0");

		// Trim trailing zeros after decimal point
		const trimmedRemainder = remainder.replace(/0+$/, "");

		return trimmedRemainder ? `${whole}.${trimmedRemainder}` : whole;
	} catch {
		throw new Error(`Invalid raw amount: ${raw}`);
	}
}

/**
 * Convert ETH to wei.
 * @param eth - Amount in ETH (e.g., "1.5")
 * @returns Amount in wei as string
 */
export function ethToWei(eth: string): string {
	return amountToRaw(eth, 18);
}

/**
 * Convert wei to ETH.
 * @param wei - Amount in wei as string
 * @returns Amount in ETH as string
 */
export function weiToEth(wei: string): string {
	return rawToAmount(wei, 18);
}

/**
 * Format wei value to Gwei.
 * @param wei - Amount in wei as string
 * @returns Amount in Gwei as string
 */
export function formatGwei(wei: string): string {
	try {
		const gwei = Number(wei) / 1e9;
		return gwei.toFixed(2);
	} catch {
		throw new Error("Invalid wei amount");
	}
}

/**
 * Calculate total transaction cost in wei.
 * @param valueWei - Transaction value in wei
 * @param gasLimit - Gas limit as string
 * @param maxFeePerGas - Max fee per gas in wei as string
 * @returns Total cost in wei as string
 */
export function calculateTotalCost(
	valueWei: string,
	gasLimit: string,
	maxFeePerGas: string,
): string {
	const value = BigInt(valueWei);
	const gas = BigInt(gasLimit);
	const feePerGas = BigInt(maxFeePerGas);
	const gasCost = gas * feePerGas;
	const total = value + gasCost;
	return total.toString();
}

/**
 * Format wei amount for display (truncated to 6 decimal places).
 * @param wei - Amount in wei as string
 * @returns Formatted ETH string
 */
export function formatWeiForDisplay(wei: string): string {
	try {
		const eth = formatEther(BigInt(wei));
		// Truncate to 6 decimal places
		const parts = eth.split(".");
		if (parts.length === 1) {
			return parts[0];
		}
		return `${parts[0]}.${parts[1].slice(0, 6)}`;
	} catch {
		return "0";
	}
}

/**
 * Truncate address for display (e.g., "0x1234...5678").
 * @param address - Full address
 * @returns Truncated address
 */
export function truncateAddress(address: string): string {
	if (address.length <= 10) return address;
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Encode ERC20 transfer function call data.
 * @param to - Recipient address
 * @param amount - Raw amount in smallest unit
 * @returns Encoded function data
 */
const ERC20_TRANSFER_ABI = [
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

export function encodeErc20Transfer(to: string, amount: string): `0x${string}` {
	return encodeFunctionData({
		abi: ERC20_TRANSFER_ABI,
		functionName: "transfer",
		args: [to as `0x${string}`, BigInt(amount)],
	});
}
