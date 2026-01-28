import type {
	BroadcastTransactionResult,
	GasEstimateResult,
	SupportedChainId,
	TronBroadcastResult,
	TronGasEstimateResult,
} from "@shared/types";
import { useQueryClient } from "@tanstack/react-query";
import {
	type FC,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import toast from "react-hot-toast";
import { isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useLocation } from "wouter";
import { AddressSafetyBadge } from "~/components/AddressSafetyBadge";
import { EnsOrAddress } from "~/components/EnsOrAddress";
import SpringTransition from "~/components/effects/SpringTransition";
import { QRScannerModal } from "~/components/QRScannerModal";
import { TokenLogo } from "~/components/TokenLogo";
import { useBroadcastTransactionMutation } from "~/hooks/mutations/useBroadcastTransactionMutation";
import { useBroadcastTronTransactionMutation } from "~/hooks/mutations/useBroadcastTronTransactionMutation";
import { useEstimateErc20GasMutation } from "~/hooks/mutations/useEstimateErc20GasMutation";
import { useEstimateGasMutation } from "~/hooks/mutations/useEstimateGasMutation";
import { useTronGasEstimateMutation } from "~/hooks/mutations/useTronGasEstimateMutation";
import { useAddressReputationQuery } from "~/hooks/queries/useAddressReputationQuery";
import {
	DEFAULT_COIN_IDS,
	usePricesQuery,
} from "~/hooks/queries/usePricesQuery";
import { useTransactionCountQuery } from "~/hooks/queries/useTransactionCountQuery";
import { useDebouncedNameResolution } from "~/hooks/useDebouncedNameResolution";
import {
	buildAndSignTrc20Transfer,
	buildAndSignTrxTransfer,
	decryptPrivateKey,
	isValidTronAddress,
	validateQRScannedData,
} from "~/lib/crypto";
import { useEvolu } from "~/lib/evolu";
import { calculateTokenUsd } from "~/lib/portfolioValue";
import {
	getBlocklistReason,
	isAddressBlocklisted,
} from "~/lib/queries/blocklist";
import { refreshAddressQueries } from "~/lib/refreshQueries";
import type { EoaId } from "~/lib/schema";
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
	weiToEth,
} from "~/lib/transaction";
import type { CoinGeckoToken } from "~/providers/tokenStore";

interface SendFormProps {
	readonly address: string;
	readonly balance: string; // Raw balance (wei for native, base units for ERC20)
	readonly encryptedPrivateKey: string;
	readonly token: CoinGeckoToken;
	readonly chainId: SupportedChainId;
	readonly walletId: EoaId;
}

export const SendForm: FC<SendFormProps> = ({
	address,
	balance,
	encryptedPrivateKey,
	token,
	chainId,
	walletId,
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

	const [recipientNameInput, setRecipientNameInput] = useState("");
	const [recipientAddress, setRecipientAddress] = useState("");
	const [_, startTransition] = useTransition();
	const [resolutionCommitted, setResolutionCommitted] = useState(false);
	const [amount, setAmount] = useState("");

	// Debounced name resolution for recipient name field
	const recipientNameResolution =
		useDebouncedNameResolution(recipientNameInput);

	// Track previous resolved address to detect when name resolution clears
	const prevResolvedAddressRef = useRef<string | null>(null);

	// Auto-fill address field when name resolves (using transition for non-blocking update)
	useEffect(() => {
		const currentResolved = recipientNameResolution.address ?? null;
		const prevResolved = prevResolvedAddressRef.current;

		// When we have a resolved address, update the recipient address
		if (currentResolved) {
			startTransition(() => {
				setRecipientAddress(currentResolved);
				setResolutionCommitted(true);
			});
			prevResolvedAddressRef.current = currentResolved;
		} else if (prevResolved && !currentResolved && !recipientNameInput) {
			// Only clear when name resolution address changes from something to nothing
			// AND name input is empty (user cleared the name field)
			// This prevents clearing manually pasted addresses
			startTransition(() => {
				setRecipientAddress("");
				setResolutionCommitted(false);
			});
			prevResolvedAddressRef.current = null;
		}
	}, [recipientNameResolution.address, recipientNameInput]);

	// Use the resolved/maintained address
	const recipient = recipientAddress;

	// Address safety checks
	const [showRiskModal, setShowRiskModal] = useState(false);
	const [isBlocklisted, setIsBlocklisted] = useState(false);
	const [blocklistReason, setBlocklistReason] = useState<string | null>(null);

	// Check address reputation (only when we have a recipient and resolution is committed)
	const addressReputationQuery = useAddressReputationQuery({
		walletId,
		address: recipient,
		incomingTxs: [],
		enabled: !!recipient && isAddress(recipient) && resolutionCommitted,
	});

	// Check blocklist when recipient changes (only after resolution is committed)
	useEffect(() => {
		// Skip if resolution is not yet committed (prevents premature queries during typing)
		if (!resolutionCommitted) return;

		async function checkBlocklist() {
			if (recipient && isAddress(recipient)) {
				const blocked = await isAddressBlocklisted(evolu, recipient);
				setIsBlocklisted(blocked);
				if (blocked) {
					const reason = await getBlocklistReason(evolu, recipient);
					setBlocklistReason(reason);
				} else {
					setBlocklistReason(null);
				}
			} else {
				setIsBlocklisted(false);
				setBlocklistReason(null);
			}
		}
		checkBlocklist();
	}, [evolu, recipient, resolutionCommitted]);

	// Combine to determine final safety level
	const safetyLevel = useMemo(() => {
		if (!recipient || !isAddress(recipient)) return null;

		// Check blocklist first
		if (isBlocklisted) return "blocklisted";

		// Check reputation
		if (addressReputationQuery.data?.safetyLevel) {
			return addressReputationQuery.data.safetyLevel;
		}

		return "new";
	}, [recipient, isBlocklisted, addressReputationQuery.data]);

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

		if (result.type === "ens" || result.type === "basename") {
			setRecipientNameInput(result.data);
			toast.success("Name scanned!");
		} else {
			setRecipientAddress(result.data);
			setResolutionCommitted(true);
			if (result.type === "evm") {
				toast.success("EVM address scanned successfully!");
			} else if (result.type === "tron") {
				toast.success("Tron address scanned successfully!");
			}
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

	// Sign and send transaction (checks safety level first)
	const sendTransaction = async () => {
		if (!gasEstimate?.ok) return;

		// Check if address is risky and show modal
		if (safetyLevel === "blocklisted" || safetyLevel === "new") {
			setShowRiskModal(true);
			setIsSending(false);
			return;
		}

		// Safe address - execute directly
		await executeTransaction();
	};

	// Execute the actual transaction (called from sendTransaction or modal)
	const executeTransaction = async () => {
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

					// Save transaction to Evolu database for address safety tracking
					evolu.insert("transaction", {
						walletId: walletId,
						txHash: result.txHash,
						from: address,
						to: recipient,
						value: amountRaw,
						gasUsed: null, // Will be updated when confirmed
						maxFeePerGas: "0", // Tron doesn't use EIP-1559 gas
						chainId: "tron",
						status: "pending",
						confirmedAt: null,
					});

					// Create statement for portfolio tracking
					evolu.insert("statement", {
						eoaId: walletId,
						chainId: "tron",
						amount: Number.parseFloat(amount) * -1,
						currency: token.symbol.toUpperCase(),
						timestamp: new Date().toISOString(),
					});

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

					// Save transaction to Evolu database for address safety tracking
					evolu.insert("transaction", {
						walletId: walletId,
						txHash: result.txHash,
						from: address,
						to: recipient,
						value: amountRaw,
						gasUsed: null, // Will be updated when confirmed
						maxFeePerGas: gasEstimate.maxFeePerGas,
						chainId: chainId.toString(),
						status: "pending",
						confirmedAt: null,
					});

					// Create statement for portfolio tracking
					evolu.insert("statement", {
						eoaId: walletId,
						chainId: chainId.toString(),
						amount: Number.parseFloat(amount) * -1,
						currency: token.symbol.toUpperCase(),
						timestamp: new Date().toISOString(),
					});

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

	// Validate amount against balance
	const amountExceedsBalance =
		amount !== "" &&
		amount !== "0" &&
		!Number.isNaN(Number.parseFloat(amount)) &&
		Number.parseFloat(amount) > Number.parseFloat(balanceFormatted);

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

								{/* Address Safety Badge */}
								{safetyLevel && (
									<div className="flex justify-between items-start">
										<span className="opacity-70">Safety:</span>
										<AddressSafetyBadge
											safetyLevel={safetyLevel}
											interactionCount={
												addressReputationQuery.data?.interactionCount
											}
											blocklistReason={blocklistReason}
										/>
									</div>
								)}

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

			{/* To - ENS/Basename Field */}
			<div className="form-control mb-4">
				<label className="label" htmlFor="send-recipient-name">
					<span className="label-text">
						ENS (.eth) or Basename (.base.eth) - Optional
					</span>
				</label>
				<div className="join w-full mb-2">
					<input
						id="send-recipient-name"
						type="text"
						className={`input input-bordered join-item grow ${recipientNameResolution.error ? "input-error" : ""}`}
						placeholder="yourname.eth or yourname.base.eth"
						value={recipientNameInput}
						onChange={(e) => setRecipientNameInput(e.target.value)}
						disabled={isSending}
						autoComplete="off"
					/>
					{recipientNameResolution.isLoading && (
						<span className="loading loading-spinner loading-sm join-item" />
					)}
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

				{/* Resolution status indicators */}
				{recipientNameResolution.isLoading && (
					<div className="text-sm opacity-70 mb-2">
						Resolving {recipientNameInput}...
					</div>
				)}

				{recipientNameResolution.address && !recipientNameResolution.error && (
					<div className="text-sm text-success mb-2">
						✓ Resolved to {recipientNameResolution.address}
					</div>
				)}

				{recipientNameResolution.error && (
					<div className="text-sm text-error mb-2">
						{recipientNameResolution.error}
					</div>
				)}

				<div className="text-xs opacity-60">
					Optional: Enter ENS or Basename to auto-resolve address
				</div>
			</div>

			{/* To - Address Field */}
			<div className="form-control mb-4">
				<label className="label" htmlFor="send-recipient-address">
					<span className="label-text">Recipient Address</span>
				</label>
				<input
					id="send-recipient-address"
					type="text"
					className="input input-bordered font-mono"
					placeholder="0x... for EVM or T... for Tron"
					value={recipientAddress}
					onChange={(e) => {
						setRecipientAddress(e.target.value);
						// Mark resolution as committed when user manually edits
						setResolutionCommitted(true);
					}}
					disabled={isSending}
					autoComplete="off"
				/>
				<div className="text-xs opacity-60 mt-2">
					Enter recipient address directly, or use ENS field above
				</div>
			</div>

			{/* Amount */}
			<div className="form-control mb-4">
				<label className="label" htmlFor="send-amount">
					<span className="label-text flex items-center gap-2">
						<TokenLogo coinId={token.id} size="large" chainId={chainId} />
						Amount ({token.symbol.toUpperCase()})
					</span>
					{!isNative && (
						<span className="label-text-alt">
							<button
								type="button"
								className="btn btn-xs btn-ghost"
								onClick={() => setAmount(balanceFormatted)}
								disabled={isSending}
							>
								Max
							</button>
						</span>
					)}
				</label>
				<input
					id="send-amount"
					type="number"
					className={`input input-bordered ${amountExceedsBalance ? "input-error" : ""}`}
					placeholder="0.0"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					disabled={isSending}
					step="0.001"
					min="0"
				/>
				{amountExceedsBalance && (
					<div className="text-sm text-error mt-2">
						Amount exceeds balance of {balanceFormatted}{" "}
						{token.symbol.toUpperCase()}
					</div>
				)}
			</div>

			{/* From */}
			<div className="form-control mb-4">
				<div className="label">
					<span className="label-text">From</span>
				</div>
				<div className="stat bg-base-200 rounded-lg">
					<div className="stat-title">
						<EnsOrAddress address={address} />
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
						disabled={
							!recipient || !amount || amountExceedsBalance || isEstimating
						}
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

			{/* Risk Confirmation Modal */}
			{showRiskModal && safetyLevel && (
				<dialog className="modal modal-open">
					<div className="modal-box">
						<h3 className="font-bold text-lg flex items-center gap-2">
							<i
								className={`fa-solid ${safetyLevel === "blocklisted" ? "fa-triangle-exclamation text-error" : "fa-circle-exclamation text-warning"}`}
							/>
							{safetyLevel === "blocklisted"
								? "Blocklisted Address"
								: "New Address Warning"}
						</h3>
						<p className="py-4">
							{safetyLevel === "blocklisted"
								? `This address is on your blocklist. ${blocklistReason ?? ""}`
								: "You haven't interacted with this address before. Please verify the recipient address carefully."}
						</p>
						<div className="alert alert-warning mb-4">
							<i className="fa-solid fa-circle-info" />
							<span className="text-sm font-mono break-all">{recipient}</span>
						</div>
						<div className="modal-action">
							<button
								type="button"
								className="btn btn-ghost"
								onClick={() => setShowRiskModal(false)}
							>
								Cancel
							</button>
							<button
								type="button"
								className="btn btn-error"
								onClick={() => {
									setShowRiskModal(false);
									executeTransaction();
								}}
							>
								I understand, proceed
							</button>
						</div>
					</div>
					<form method="dialog" className="modal-backdrop">
						<button type="button" onClick={() => setShowRiskModal(false)}>
							Close
						</button>
					</form>
				</dialog>
			)}
		</div>
	);
};
