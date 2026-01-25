import { useEvolu } from "@evolu/react";
import type {
	BroadcastTransactionResult,
	GasEstimateResult,
	SupportedChainId,
	TronBroadcastResult,
	TronGasEstimateResult,
} from "@shared/types";
import { useQueryClient } from "@tanstack/react-query";
import { type FC, useState } from "react";
import toast from "react-hot-toast";
import { isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useLocation } from "wouter";
import { EnsOrAddress } from "~/components/EnsOrAddress";
import SpringTransition from "~/components/effects/SpringTransition";
import { QRScannerModal } from "~/components/QRScannerModal";
import { TokenLogo } from "~/components/TokenLogo";
import { useBroadcastTransactionMutation } from "~/hooks/mutations/useBroadcastTransactionMutation";
import { useBroadcastTronTransactionMutation } from "~/hooks/mutations/useBroadcastTronTransactionMutation";
import { useEstimateErc20GasMutation } from "~/hooks/mutations/useEstimateErc20GasMutation";
import { useEstimateGasMutation } from "~/hooks/mutations/useEstimateGasMutation";
import { useTronGasEstimateMutation } from "~/hooks/mutations/useTronGasEstimateMutation";
import {
	DEFAULT_COIN_IDS,
	usePricesQuery,
} from "~/hooks/queries/usePricesQuery";
import { useTransactionCountQuery } from "~/hooks/queries/useTransactionCountQuery";
import {
	buildAndSignTrc20Transfer,
	buildAndSignTrxTransfer,
	decryptPrivateKey,
	isValidTronAddress,
	validateQRScannedData,
} from "~/lib/crypto";
import { calculateTokenUsd } from "~/lib/portfolioValue";
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
	const broadcastTronTransactionMutation =
		useBroadcastTronTransactionMutation();
	const tronGasEstimateMutation = useTronGasEstimateMutation();

	const transactionCountQuery = useTransactionCountQuery({
		address,
		chainId,
		enabled: false,
	});

	// Fetch prices for USD calculations
	const { data: pricesData } = usePricesQuery({
		coinIds: DEFAULT_COIN_IDS,
	});

	const isTron = chainId === "tron";

	// Type guard for EVM gas estimate
	function isEvmGasEstimate(
		estimate: GasEstimateResult | TronGasEstimateResult,
	): estimate is GasEstimateResult {
		return "gasLimit" in estimate && estimate.ok;
	}

	// Type guard for Tron gas estimate
	function isTronGasEstimate(
		estimate: GasEstimateResult | TronGasEstimateResult,
	): estimate is TronGasEstimateResult {
		return "bandwidthRequired" in estimate && estimate.ok;
	}

	// Get token properties
	const tokenAddress = getTokenAddress(token, chainId);
	const decimals = getTokenDecimals(token, chainId);
	const isNative = isNativeToken(token, chainId);

	const [recipient, setRecipient] = useState("");
	const [amount, setAmount] = useState("");
	const [gasEstimate, setGasEstimate] = useState<
		GasEstimateResult | TronGasEstimateResult | null
	>(null);
	const [isEstimating, setIsEstimating] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [showQRScanner, setShowQRScanner] = useState(false);

	// Handle QR scan success
	const handleQRScanSuccess = (scannedData: string) => {
		const result = validateQRScannedData(scannedData);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}

		setRecipient(result.data);
		if (result.type === "evm") {
			toast.success("EVM address scanned successfully!");
		} else if (result.type === "ens") {
			toast.success("ENS name scanned!");
		} else if (result.type === "tron") {
			toast.success("Tron address scanned successfully!");
		}
	};

	// Estimate gas when recipient or amount changes
	const estimateGas = async () => {
		if (!recipient || !amount) return;

		// Validate address based on chain
		if (isTron) {
			if (!isValidTronAddress(recipient)) {
				toast.error("Invalid Tron address");
				return;
			}
		} else {
			if (!isAddress(recipient)) {
				toast.error("Invalid recipient address");
				return;
			}
		}

		setIsEstimating(true);
		try {
			if (isTron) {
				// Tron gas estimation
				// For native TRX, pass empty contract; for TRC20, pass contract address
				const contractAddress = isNative ? "" : tokenAddress;
				const amountRaw = isNative
					? amountToRaw(amount, decimals) // TRX uses 6 decimals
					: amountToRaw(amount, decimals);

				const result: TronGasEstimateResult =
					await tronGasEstimateMutation.mutateAsync({
						from: address,
						to: recipient,
						contract: contractAddress,
						amount: amountRaw,
					});

				if (!result.ok) {
					toast.error(result.error);
					setGasEstimate(null);
					return;
				}

				setGasEstimate(result);
			} else {
				// EVM gas estimation
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
			}
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
				if (isTron) {
					// Tron transaction flow
					if (!isTronGasEstimate(gasEstimate)) {
						toast.error("Invalid gas estimate for Tron transaction");
						return;
					}

					const amountRaw = amountToRaw(amount, decimals);

					// Build and sign the transfer - use native TRX or TRC20 based on token type
					const signedTx = isNative
						? await buildAndSignTrxTransfer(
								privateKey as `0x${string}`,
								recipient, // to
								amountRaw, // amount in SUN
							)
						: await buildAndSignTrc20Transfer(
								privateKey as `0x${string}`,
								recipient, // to
								tokenAddress, // contract
								amountRaw, // amount
							);

					// Broadcast via backend API (transaction object needs to be stringified)
					const result: TronBroadcastResult =
						await broadcastTronTransactionMutation.mutateAsync({
							signedTransaction: JSON.stringify(signedTx),
						});

					if (!result.ok) {
						toast.error(result.error);
						return;
					}

					// Refresh all address-related queries for sender + recipient
					await Promise.all([
						refreshAddressQueries(queryClient, address),
						refreshAddressQueries(queryClient, recipient),
					]);

					toast.success("Transaction submitted!");

					// Navigate to transaction status page
					navigate(`/transaction/${result.txHash}?chainId=${chainId}`);
				} else {
					// EVM transaction flow
					if (!isEvmGasEstimate(gasEstimate)) {
						toast.error("Invalid gas estimate for EVM transaction");
						return;
					}

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
				}
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

	// Calculate USD values
	const tokenPrice =
		pricesData?.ok && pricesData.prices[token.id]
			? pricesData.prices[token.id].usd
			: null;
	const amountUsd =
		tokenPrice && amount ? calculateTokenUsd(amount, tokenPrice) : null;

	const ethPrice =
		pricesData?.ok && pricesData.prices.ethereum
			? pricesData.prices.ethereum.usd
			: null;

	const totalCost =
		gasEstimate?.ok && amount
			? isTron && isTronGasEstimate(gasEstimate)
				? gasEstimate.totalCostTrx // Tron provides total cost directly
				: isEvmGasEstimate(gasEstimate)
					? calculateTotalCost(
							isNative ? ethToWei(amount) : amountToRaw(amount, decimals),
							gasEstimate.gasLimit,
							gasEstimate.maxFeePerGas,
						)
					: "0"
			: "0";

	const totalCostEth = isTron ? totalCost : weiToEth(totalCost);
	const totalCostUsd =
		ethPrice && totalCostEth ? calculateTokenUsd(totalCostEth, ethPrice) : null;
	const hasEnoughBalance =
		BigInt(balance) >=
		BigInt(isNative ? ethToWei(amount) : amountToRaw(amount, decimals));

	return (
		<div className="max-w-md mx-auto p-4">
			<h1 className="text-2xl font-bold mb-6">Send Crypto</h1>

			{/* Actions - shown at very top when gas estimate exists */}
			{gasEstimate?.ok && (
				<div className="flex gap-2 mb-4">
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
						className="btn btn-secondary flex-1"
						onClick={sendTransaction}
						disabled={isSending || !hasEnoughBalance}
					>
						{isSending ? <span className="loading loading-spinner" /> : "Send"}
						{hasEnoughBalance ? (
							<i
								className="fa-solid fa-paper-plane"
								style={{ fontSize: "1.25rem" }}
								aria-hidden="true"
							/>
						) : (
							<span className="text-error text-sm">Insufficient balance</span>
						)}
					</button>
				</div>
			)}

			{/* Transaction Details Card */}
			<SpringTransition isActive={!!gasEstimate?.ok} skipExit={true}>
				{gasEstimate?.ok && (
					<div className="mb-6 card card-compact bg-base-200">
						<div className="card-body">
							<h3 className="card-title text-sm mb-4">Transaction Details</h3>
							<div className="space-y-3 text-sm">
								{/* To */}
								<div className="flex justify-between items-start">
									<span className="opacity-70">To:</span>
									<span className="text-right w-full" title={recipient}>
										<EnsOrAddress address={recipient} />
									</span>
								</div>

								{/* Amount */}
								<div className="flex justify-between items-start">
									<span className="opacity-70">Amount:</span>
									<div className="text-right">
										<div className="font-semibold">
											{amount} {token.symbol.toUpperCase()}
										</div>
										{amountUsd !== null && (
											<div className="text-xs opacity-70">
												≈${amountUsd.toFixed(2)} USD
											</div>
										)}
									</div>
								</div>

								{/* Gas */}
								{isTron && isTronGasEstimate(gasEstimate) ? (
									<>
										<div className="flex justify-between items-start">
											<span className="opacity-70">Bandwidth:</span>
											<span>{gasEstimate.bandwidthRequired}</span>
										</div>
										<div className="flex justify-between items-start">
											<span className="opacity-70">Energy:</span>
											<span>{gasEstimate.energyRequired}</span>
										</div>
										<div className="flex justify-between items-start">
											<span className="opacity-70">Energy Fee:</span>
											<span>{gasEstimate.energyFee} SUN</span>
										</div>
										<div className="flex justify-between items-start border-t border-base-300 pt-2 mt-2">
											<span className="opacity-70">Gas Cost:</span>
											<div className="text-right">
												{totalCostUsd !== null && (
													<div className="text-xs font-semibold">
														≈${totalCostUsd.toFixed(2)} USD
													</div>
												)}
												<div className="opacity-70">
													{gasEstimate.totalCostTrx} TRX
												</div>
											</div>
										</div>
									</>
								) : isEvmGasEstimate(gasEstimate) ? (
									<>
										<div className="flex justify-between items-start">
											<span className="opacity-70">Gas Limit:</span>
											<span>{gasEstimate.gasLimit}</span>
										</div>
										<div className="flex justify-between items-start">
											<span className="opacity-70">Max Fee:</span>
											<span>{formatGwei(gasEstimate.maxFeePerGas)} Gwei</span>
										</div>
										<div className="flex justify-between items-start border-t border-base-300 pt-2 mt-2">
											<span className="opacity-70">Gas Cost:</span>
											<div className="text-right">
												{totalCostUsd !== null && (
													<div className="text-xs font-semibold">
														≈${totalCostUsd.toFixed(2)} USD
													</div>
												)}
												<div className="opacity-70">
													{gasEstimate.totalCostEth} ETH
												</div>
											</div>
										</div>
									</>
								) : null}
							</div>
						</div>
					</div>
				)}
			</SpringTransition>

			{/* To */}
			<div className="form-control mb-4">
				<label className="label" htmlFor="send-recipient">
					<span className="label-text">Recipient Address</span>
				</label>
				<div className="join w-full">
					<input
						id="send-recipient"
						type="text"
						className="input input-bordered join-item grow font-mono"
						placeholder="0x... or scan QR"
						value={recipient}
						onChange={(e) => setRecipient(e.target.value)}
						disabled={isSending}
					/>
					<button
						type="button"
						className="btn btn-primary join-item btn-square"
						onClick={() => setShowQRScanner(true)}
						disabled={isSending}
						title="Scan QR code"
					>
						<i className="fa-solid fa-qrcode" />
					</button>
				</div>
			</div>

			{/* Amount */}
			<div className="form-control mb-4">
				<label className="label" htmlFor="send-amount">
					<span className="label-text flex items-center gap-2">
						<TokenLogo coinId={token.id} size="large" chainId={chainId} />
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

			{/* Actions - only show Estimate Gas button when no estimate */}
			{!gasEstimate && (
				<div className="flex gap-2">
					<button
						type="button"
						className="btn btn-secondary flex-1"
						onClick={estimateGas}
						disabled={!recipient || !amount || isEstimating}
					>
						{isEstimating ? (
							<span className="loading loading-spinner" />
						) : (
							<>
								Review
								<i
									className="fa-solid fa-check"
									style={{ fontSize: "1.25rem" }}
									aria-hidden="true"
								/>
							</>
						)}
					</button>
				</div>
			)}

			{/* QR Scanner Modal */}
			<QRScannerModal
				isOpen={showQRScanner}
				onClose={() => setShowQRScanner(false)}
				onScanSuccess={handleQRScanSuccess}
			/>
		</div>
	);
};
