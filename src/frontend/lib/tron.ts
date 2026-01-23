/**
 * Type-safe TronWeb utilities
 *
 * Uses TronWeb static methods directly without unsafe type assertions.
 * See: https://www.trongrid.io/docs/tronweb/
 */

import { TronWeb } from "tronweb";

/**
 * Validates a Tron base58check address using TronWeb.isAddress
 * @param address - The address to validate
 * @returns true if valid Tron address, false otherwise
 */
export function isValidTronAddress(address: string): boolean {
	try {
		return TronWeb.isAddress(address);
	} catch {
		return false;
	}
}

/**
 * Derives Tron address from private key using TronWeb.address.fromPrivateKey
 * @param privateKeyHex - Private key as hex string with 0x prefix
 * @returns Tron base58check address (T-address)
 * @throws Error if private key invalid or derivation fails
 */
export function deriveTronAddress(privateKeyHex: `0x${string}`): string {
	if (!/^0x[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
		throw new Error("Invalid private key format");
	}

	try {
		const privateKeyBytes = privateKeyHex.slice(2);
		const address = TronWeb.address.fromPrivateKey(privateKeyBytes);

		if (!address || typeof address !== "string") {
			throw new Error("TronWeb.address.fromPrivateKey returned invalid result");
		}

		return address;
	} catch (error) {
		throw new Error(
			`Failed to derive Tron address: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Creates a TronWeb instance for transaction operations
 * @param privateKeyHex - Private key as hex string with 0x prefix (optional)
 * @returns TronWeb instance
 */
export function createTronWebInstance(
	privateKeyHex?: `0x${string}`,
): InstanceType<typeof TronWeb> {
	const options = {
		fullNode: "https://api.trongrid.io",
		solidityNode: "https://api.trongrid.io",
		eventServer: "https://api.trongrid.io",
	};

	if (privateKeyHex) {
		return new TronWeb(
			options.fullNode,
			options.solidityNode,
			options.eventServer,
			privateKeyHex.slice(2), // TronWeb expects private key without 0x prefix
		);
	}

	return new TronWeb(
		options.fullNode,
		options.solidityNode,
		options.eventServer,
	);
}

/**
 * Builds and signs a native TRX transfer transaction
 *
 * Uses TronWeb's transactionBuilder.sendTrx to build a native TRX transfer.
 *
 * @param privateKeyHex - Private key as hex string with 0x prefix
 * @param to - Recipient address (base58)
 * @param amountSun - Amount in SUN (smallest unit, 1 TRX = 1,000,000 SUN)
 * @returns Signed transaction object ready for broadcast
 * @throws Error if building or signing fails
 */
export async function buildAndSignTrxTransfer(
	privateKeyHex: `0x${string}`,
	to: string,
	amountSun: string,
): Promise<unknown> {
	if (!/^0x[0-a-fA-F]{64}$/.test(privateKeyHex)) {
		throw new Error("Invalid private key format");
	}

	try {
		const tronWeb = createTronWebInstance(privateKeyHex);
		const fromAddress = tronWeb.defaultAddress.base58;

		if (typeof fromAddress !== "string") {
			throw new Error("Failed to get from address from TronWeb instance");
		}

		// Build the transaction using sendTrx
		const transaction = await tronWeb.transactionBuilder.sendTrx(
			to,
			Number(amountSun),
			fromAddress,
		);

		if (!transaction) {
			throw new Error("Failed to build transaction: invalid result");
		}

		// Sign the transaction
		const signedResult = await tronWeb.trx.sign(transaction);

		if (!signedResult) {
			throw new Error("Failed to sign transaction: invalid result");
		}

		return signedResult;
	} catch (error) {
		throw new Error(
			`Failed to build TRX transfer: ${error instanceof Error ? error.message : "unknown error"}`,
		);
	}
}

/**
 * Builds and signs a TRC20 transfer transaction
 *
 * Uses TronWeb's triggerSmartContract to build a TRC20 transfer transaction.
 * The transfer function signature is: transfer(address,uint256)
 *
 * @param privateKeyHex - Private key as hex string with 0x prefix
 * @param to - Recipient address (base58)
 * @param contract - TRC20 contract address (base58)
 * @param amount - Amount in smallest unit (string)
 * @returns Signed transaction object ready for broadcast
 * @throws Error if building or signing fails
 */
export async function buildAndSignTrc20Transfer(
	privateKeyHex: `0x${string}`,
	to: string,
	contract: string,
	amount: string,
): Promise<unknown> {
	if (!/^0x[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
		throw new Error("Invalid private key format");
	}

	try {
		const tronWeb = createTronWebInstance(privateKeyHex);

		// Convert address to hex format for the contract call
		const toHex = tronWeb.address.toHex(to);

		// Build TRC20 transfer using triggerSmartContract
		// Function signature: transfer(address,uint256) = 0xa9059cbb
		// Parameters: recipient_address (32 bytes), amount (32 bytes)
		const functionSelector = "a9059cbb";
		const parameter = [
			{ type: "address", value: toHex.slice(2) }, // Remove 0x prefix
			{ type: "uint256", value: amount },
		];

		// Build the transaction
		const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
			contract,
			functionSelector,
			{
				feeLimit: 150000000, // Default fee limit for TRC20 transfers
			},
			parameter,
		);

		if (!transaction || !transaction.transaction) {
			throw new Error("Failed to build transaction: invalid result");
		}

		// Sign the transaction
		const signedResult = await tronWeb.trx.sign(transaction.transaction);

		// Return the signed transaction object
		if (!signedResult) {
			throw new Error("Failed to sign transaction: invalid result");
		}

		return signedResult;
	} catch (error) {
		throw new Error(
			`Failed to build TRC20 transfer: ${error instanceof Error ? error.message : "unknown error"}`,
		);
	}
}
