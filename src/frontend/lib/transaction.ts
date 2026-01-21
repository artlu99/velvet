/**
 * Transaction utility functions for the frontend.
 * Handles ETH/wei conversions and gas calculations.
 */

import { formatEther, parseEther } from "viem";

/**
 * Convert ETH to wei.
 * @param eth - Amount in ETH (e.g., "1.5")
 * @returns Amount in wei as string
 */
export function ethToWei(eth: string): string {
	try {
		const wei = parseEther(eth);
		return wei.toString();
	} catch {
		throw new Error("Invalid ETH amount");
	}
}

/**
 * Convert wei to ETH.
 * @param wei - Amount in wei as string
 * @returns Amount in ETH as string
 */
export function weiToEth(wei: string): string {
	try {
		const eth = formatEther(BigInt(wei));
		return eth;
	} catch {
		throw new Error("Invalid wei amount");
	}
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
 * Validate Ethereum address format.
 * @param address - Address to validate
 * @returns true if valid EVM address
 */
export function isValidAddress(address: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(address);
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
