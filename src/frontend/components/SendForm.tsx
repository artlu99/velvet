import type {
	BroadcastTransactionResult,
	GasEstimateResult,
	TransactionCountResult,
} from "@shared/types";
import { type FC, useState } from "react";
import toast from "react-hot-toast";
import { privateKeyToAccount } from "viem/accounts";
import { Link, useLocation } from "wouter";
import {
	calculateTotalCost,
	ethToWei,
	formatGwei,
	isValidAddress,
	truncateAddress,
	weiToEth,
} from "~/lib/transaction";
import { useReceiveStore } from "~/providers/store";

interface SendFormProps {
	readonly walletId: string;
	readonly address: string;
	readonly balance: string; // wei
	readonly privateKey: string;
}

export const SendForm: FC<SendFormProps> = ({
	walletId: _walletId,
	address,
	balance,
	privateKey,
}) => {
	const [, navigate] = useLocation();
	const { network } = useReceiveStore();
	const chainId = network === "ethereum" ? 1 : 8453;

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

		if (!isValidAddress(recipient)) {
			toast.error("Invalid recipient address");
			return;
		}

		setIsEstimating(true);
		try {
			const valueWei = ethToWei(amount);

			const response = await fetch("/api/estimate-gas", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					from: address,
					to: recipient,
					value: valueWei,
					chainId,
				}),
			});

			const result: GasEstimateResult = await response.json();

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
			// Create account from private key
			const account = privateKeyToAccount(privateKey as `0x${string}`);

			// Fetch nonce (transaction count)
			const nonceResponse = await fetch(
				`/api/transaction-count/${address}?chainId=${chainId}`,
			);
			const nonceResult: TransactionCountResult = await nonceResponse.json();

			if (!nonceResult.ok) {
				toast.error(nonceResult.error);
				return;
			}

			// Build transaction parameters
			const valueWei = ethToWei(amount);

			// Sign transaction - EIP-1559 format
			const signedTx = await account.signTransaction({
				to: recipient as `0x${string}`,
				value: BigInt(valueWei),
				gas: BigInt(gasEstimate.gasLimit),
				maxFeePerGas: BigInt(gasEstimate.maxFeePerGas),
				maxPriorityFeePerGas: BigInt(gasEstimate.maxPriorityFeePerGas),
				chainId,
				nonce: nonceResult.nonce,
				type: "eip1559",
			});

			// Broadcast via backend API
			const response = await fetch("/api/broadcast-transaction", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					signedTransaction: signedTx,
					chainId,
				}),
			});

			const result: BroadcastTransactionResult = await response.json();

			if (!result.ok) {
				toast.error(result.error);
				return;
			}

			// Save transaction to Evolu database
			// Note: Skipped for now due to type issues
			// Transaction will be tracked on blockchain

			toast.success("Transaction submitted!");

			// Navigate to transaction status page
			navigate(`/transaction/${result.txHash}?chainId=${chainId}`);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			toast.error(`Failed to send transaction: ${errorMessage}`);
			console.error("Transaction error:", error);
		} finally {
			setIsSending(false);
		}
	};

	const balanceEth = weiToEth(balance);
	const totalCost =
		gasEstimate?.ok && amount
			? calculateTotalCost(
					ethToWei(amount),
					gasEstimate.gasLimit,
					gasEstimate.maxFeePerGas,
				)
			: "0";
	const totalCostEth = weiToEth(totalCost);
	const hasEnoughBalance = BigInt(balance) >= BigInt(totalCost);

	return (
		<div className="max-w-md mx-auto p-4">
			<div className="mb-6">
				<Link href="/wallets" className="btn btn-ghost btn-sm">
					<i className="fa-solid fa-arrow-left mr-2" aria-hidden="true" />
					Back to Wallets
				</Link>
			</div>

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
					<div className="stat-desc">Balance: {balanceEth} ETH</div>
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
					<span className="label-text">Amount (ETH)</span>
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

			{/* Network */}
			<div className="form-control mb-4">
				<div className="label">
					<span className="label-text">Network</span>
				</div>
				<div className="join w-full">
					<button
						type="button"
						className={`join-item btn ${network === "ethereum" ? "btn-active" : ""}`}
						disabled
						aria-label="Ethereum network"
					>
						Ethereum
					</button>
					<button
						type="button"
						className={`join-item btn ${network === "base" ? "btn-active" : ""}`}
						disabled
						aria-label="Base network"
					>
						Base
					</button>
				</div>
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
						<span className="text-xl font-bold">{totalCostEth} ETH</span>
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
