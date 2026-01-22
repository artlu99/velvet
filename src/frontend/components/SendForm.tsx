import { useEvolu } from "@evolu/react";
import type {
	BroadcastTransactionResult,
	GasEstimateResult,
	SupportedChainId,
} from "@shared/types";
import { useQueryClient } from "@tanstack/react-query";
import { type FC, useState } from "react";
import toast from "react-hot-toast";
import { isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useLocation } from "wouter";
import { useBroadcastTransactionMutation } from "~/hooks/mutations/useBroadcastTransactionMutation";
import { useEstimateErc20GasMutation } from "~/hooks/mutations/useEstimateErc20GasMutation";
import { useEstimateGasMutation } from "~/hooks/mutations/useEstimateGasMutation";
import { useTransactionCountQuery } from "~/hooks/queries/useTransactionCountQuery";
import { decryptPrivateKey } from "~/lib/crypto";
import { refreshAddressQueries } from "~/lib/refreshQueries";
import {
	getTokenAddress,
	getTokenDecimals,
	isNativeToken,
} from "~/lib/tokenUtils";
import {
	amountToRaw,
	calculateTotalCost,
	encodeErc20Transfer,
	ethToWei,
	formatGwei,
	rawToAmount,
	truncateAddress,
	weiToEth,
} from "~/lib/transaction";
import type { CoinGeckoToken } from "~/providers/tokenStore";

interface SendFormProps {
	readonly address: string;
	readonly balance: string; // Raw balance (wei for native, base units for ERC20)
	readonly encryptedPrivateKey: string;
	readonly token: CoinGeckoToken;
	readonly chainId: SupportedChainId;
}

export const SendForm: FC<SendFormProps> = ({
	address,
	balance,
	encryptedPrivateKey,
	token,
	chainId,
}) => {
	const [, navigate] = useLocation();
	const evolu = useEvolu();
	const queryClient = useQueryClient();

	const broadcastTransactionMutation = useBroadcastTransactionMutation();
	const estimateGasMutation = useEstimateGasMutation();
	const estimateErc20GasMutation = useEstimateErc20GasMutation();

	const transactionCountQuery = useTransactionCountQuery({
		address,
		chainId,
		enabled: false,
	});

	// Get token properties
	const tokenAddress = getTokenAddress(token, chainId);
	const decimals = getTokenDecimals(token, chainId);
	const isNative = isNativeToken(token, chainId);

	const [recipient, setRecipient] = useState("");
	const [amount, setAmount] = useState("");
	const [gasEstimate, setGasEstimate] = useState<GasEstimateResult | null>(
		null,
	);
	const [isEstimating, setIsEstimating] = useState(false);
	const [isSending, setIsSending] = useState(false);

	// Estimate gas when recipient or amount changes
	const estimateGas = async () => {
		if (!recipient || !amount) return;

		if (!isAddress(recipient)) {
			toast.error("Invalid recipient address");
			return;
		}

		setIsEstimating(true);
		try {
			const amountRaw = isNative
				? ethToWei(amount)
				: amountToRaw(amount, decimals);

			const result: GasEstimateResult = isNative
				? await estimateGasMutation.mutateAsync({
						from: address,
						to: recipient,
						value: amountRaw,
						chainId,
					})
				: await estimateErc20GasMutation.mutateAsync({
						from: address,
						to: recipient,
						contract: tokenAddress,
						amount: amountRaw,
						chainId,
					});

			if (!result.ok) {
				toast.error(result.error);
				setGasEstimate(null);
				return;
			}

			setGasEstimate(result);
		} catch {
			toast.error("Failed to estimate gas");
		} finally {
			setIsEstimating(false);
		}
	};

	// Sign and send transaction
	const sendTransaction = async () => {
		if (!gasEstimate?.ok) return;

		setIsSending(true);
		try {
			// Get encryption key from Evolu context (inline, no state)
			const owner = await evolu.appOwner;
			const encryptionKey = owner.encryptionKey;

			// Decrypt private key inline
			const decryptResult = decryptPrivateKey(
				encryptedPrivateKey,
				encryptionKey,
			);

			if (!decryptResult.ok) {
				toast.error("Failed to decrypt private key");
				return;
			}

			const privateKey = decryptResult.value;

			try {
				// Create account from private key
				const account = privateKeyToAccount(privateKey as `0x${string}`);

				// Fetch nonce (transaction count)
				const { data: nonceResult } = await transactionCountQuery.refetch();

				if (!nonceResult || !nonceResult.ok) {
					toast.error(
						nonceResult?.error ?? "Failed to fetch transaction count",
					);
					return;
				}

				// Build transaction parameters
				const amountRaw = isNative
					? ethToWei(amount)
					: amountToRaw(amount, decimals);

				// Sign transaction - EIP-1559 format
				const signedTx = await account.signTransaction({
					to: isNative
						? (recipient as `0x${string}`)
						: (tokenAddress as `0x${string}`),
					value: isNative ? BigInt(amountRaw) : 0n,
					data: isNative
						? undefined
						: encodeErc20Transfer(recipient, amountRaw),
					gas: BigInt(gasEstimate.gasLimit),
					maxFeePerGas: BigInt(gasEstimate.maxFeePerGas),
					maxPriorityFeePerGas: BigInt(gasEstimate.maxPriorityFeePerGas),
					chainId,
					nonce: nonceResult.nonce,
					type: "eip1559",
				});

				// Broadcast via backend API
				const result: BroadcastTransactionResult =
					await broadcastTransactionMutation.mutateAsync({
						signedTransaction: signedTx,
						chainId,
					});

				if (!result.ok) {
					toast.error(result.error);
					return;
				}

				// Refresh all address-related queries (balance, transaction-count) for sender + recipient
				// Uses cacheBust=1 for balance queries to bypass KV cache
				await Promise.all([
					refreshAddressQueries(queryClient, address),
					refreshAddressQueries(queryClient, recipient),
				]);

				// Save transaction to Evolu database
				// Note: Skipped for now due to type issues
				// Transaction will be tracked on blockchain

				toast.success("Transaction submitted!");

				// Navigate to transaction status page
				navigate(`/transaction/${result.txHash}?chainId=${chainId}`);
			} finally {
				// Note: privateKey is a string and cannot be securely wiped.
				// The decrypted bytes in decryptPrivateKey are already wiped.
				// The string will be garbage collected when it goes out of scope.
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			toast.error(`Failed to send transaction: ${errorMessage}`);
			console.error("Transaction error:", error);
		} finally {
			setIsSending(false);
		}
	};

	const balanceFormatted = isNative
		? weiToEth(balance)
		: rawToAmount(balance, decimals);

	const totalCost =
		gasEstimate?.ok && amount
			? calculateTotalCost(
					isNative ? ethToWei(amount) : amountToRaw(amount, decimals),
					gasEstimate.gasLimit,
					gasEstimate.maxFeePerGas,
				)
			: "0";

	const totalCostEth = weiToEth(totalCost);
	const hasEnoughBalance =
		BigInt(balance) >=
		BigInt(isNative ? ethToWei(amount) : amountToRaw(amount, decimals));

	return (
		<div className="max-w-md mx-auto p-4">
			<h1 className="text-2xl font-bold mb-6">Send Crypto</h1>

			{/* From */}
			<div className="form-control mb-4">
				<div className="label">
					<span className="label-text">From</span>
				</div>
				<div className="stat bg-base-200 rounded-lg">
					<div className="stat-title font-mono text-sm">
						{truncateAddress(address)}
					</div>
					<div className="stat-desc">
						Balance: {balanceFormatted} {token.symbol.toUpperCase()}
					</div>
				</div>
			</div>

			{/* To */}
			<div className="form-control mb-4">
				<label className="label" htmlFor="send-recipient">
					<span className="label-text">Recipient Address</span>
				</label>
				<input
					id="send-recipient"
					type="text"
					className="input input-bordered font-mono"
					placeholder="0x..."
					value={recipient}
					onChange={(e) => setRecipient(e.target.value)}
					disabled={isSending}
				/>
			</div>

			{/* Amount */}
			<div className="form-control mb-4">
				<label className="label" htmlFor="send-amount">
					<span className="label-text">
						Amount ({token.symbol.toUpperCase()})
					</span>
				</label>
				<input
					id="send-amount"
					type="number"
					className="input input-bordered"
					placeholder="0.0"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					disabled={isSending}
					step="0.001"
					min="0"
				/>
			</div>

			{/* Gas Estimate */}
			{gasEstimate?.ok && (
				<div className="mb-4 card card-compact bg-base-200">
					<div className="card-body">
						<h3 className="card-title text-sm">Estimated Gas Fees</h3>
						<div className="text-sm space-y-1">
							<div>Gas Limit: {gasEstimate.gasLimit}</div>
							<div>Max Fee: {formatGwei(gasEstimate.maxFeePerGas)} Gwei</div>
							<div className="font-semibold">
								Cost: {gasEstimate.totalCostEth} ETH
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Total */}
			{gasEstimate?.ok && amount && (
				<div className="mb-6">
					<div className="flex justify-between items-center">
						<span className="font-semibold">Total:</span>
						<span className="text-xl font-bold">
							{totalCostEth} {token.symbol.toUpperCase()}
						</span>
					</div>
					{!hasEnoughBalance && (
						<div className="text-error text-sm mt-1">Insufficient balance</div>
					)}
				</div>
			)}

			{/* Actions */}
			<div className="flex gap-2">
				{!gasEstimate ? (
					<button
						type="button"
						className="btn btn-primary flex-1"
						onClick={estimateGas}
						disabled={!recipient || !amount || isEstimating}
					>
						{isEstimating ? (
							<span className="loading loading-spinner" />
						) : (
							"Estimate Gas"
						)}
					</button>
				) : (
					<>
						<button
							type="button"
							className="btn btn-outline flex-1"
							onClick={() => setGasEstimate(null)}
							disabled={isSending}
						>
							Edit
						</button>
						<button
							type="button"
							className="btn btn-primary flex-1"
							onClick={sendTransaction}
							disabled={isSending || !hasEnoughBalance}
						>
							{isSending ? (
								<span className="loading loading-spinner" />
							) : (
								"Send"
							)}
						</button>
					</>
				)}
			</div>
		</div>
	);
};
