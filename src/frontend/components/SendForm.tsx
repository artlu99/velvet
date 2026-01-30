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
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
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

	// Type guards (stable, defined once at top level)
	const isEvmGasEstimate = useCallback(
		(
			estimate: GasEstimateResult | TronGasEstimateResult,
		): estimate is GasEstimateResult => {
			return "gasLimit" in estimate && estimate.ok;
		},
		[],
	);

	const isTronGasEstimate = useCallback(
		(
			estimate: GasEstimateResult | TronGasEstimateResult,
		): estimate is TronGasEstimateResult => {
			return "bandwidthRequired" in estimate && estimate.ok;
		},
		[],
	);

	// Get token properties (stable calculations)
	const tokenAddress = getTokenAddress(token, chainId);
	const decimals = getTokenDecimals(token, chainId);
	const isNative = isNativeToken(token, chainId);
	const balanceFormatted = useMemo(
		() => (isNative ? weiToEth(balance) : rawToAmount(balance, decimals)),
		[balance, decimals, isNative],
	);

	// Form state
	const [recipientNameInput, setRecipientNameInput] = useState("");
	const [recipientAddress, setRecipientAddress] = useState("");
	const [amount, setAmount] = useState("");
	const [gasEstimate, setGasEstimate] = useState<
		GasEstimateResult | TronGasEstimateResult | null
	>(null);
	const [isEstimating, setIsEstimating] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [showQRScanner, setShowQRScanner] = useState(false);

	// Track resolution state with ref to avoid effect loops
	const resolutionCommittedRef = useRef(false);
	const prevResolvedAddressRef = useRef<string | null>(null);

	// Debounced name resolution for recipient name field
	const recipientNameResolution =
		useDebouncedNameResolution(recipientNameInput);

	// Auto-fill address field when name resolves (no dependency on recipientAddress)
	useEffect(() => {
		const currentResolved = recipientNameResolution.address ?? null;
		const prevResolved = prevResolvedAddressRef.current;

		if (currentResolved && currentResolved !== prevResolved) {
			// When we have a resolved address, update the recipient address
			setRecipientAddress(currentResolved);
			resolutionCommittedRef.current = true;
			prevResolvedAddressRef.current = currentResolved;
		} else if (prevResolved && !currentResolved && !recipientNameInput) {
			// Only clear when name resolution address changes from something to nothing
			// AND name input is empty (user cleared the name field)
			setRecipientAddress("");
			resolutionCommittedRef.current = false;
			prevResolvedAddressRef.current = null;
		}
	}, [recipientNameResolution.address, recipientNameInput]);

	// Derived value (no state update, no re-render cascade)
	const recipient = recipientAddress;

	// Address safety state
	const [showRiskModal, setShowRiskModal] = useState(false);
	const [isBlocklisted, setIsBlocklisted] = useState(false);
	const [blocklistReason, setBlocklistReason] = useState<string | null>(null);

	// Check address reputation (only when we have a recipient and resolution is committed)
	const addressReputationQuery = useAddressReputationQuery({
		walletId,
		address: recipient,
		incomingTxs: [],
		enabled:
			!!recipient && isAddress(recipient) && resolutionCommittedRef.current,
	});

	// Check blocklist when recipient changes (only after resolution is committed)
	useEffect(() => {
		// Skip if resolution is not yet committed (prevents premature queries during typing)
		if (!resolutionCommittedRef.current) return;

		async function checkBlocklist() {
			if (recipient && isAddress(recipient)) {
				const blocked = await isAddressBlocklisted(recipient);
				setIsBlocklisted(blocked);
				if (blocked) {
					const reason = await getBlocklistReason(recipient);
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
	}, [recipient]);

	// Safety level (memoized)
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

	// Stable callbacks with useCallback
	const handleRecipientAddressChange = useCallback((value: string) => {
		setRecipientAddress(value);
		resolutionCommittedRef.current = true;
	}, []);

	const handleQRScanSuccess = useCallback((scannedData: string) => {
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
			resolutionCommittedRef.current = true;
			if (result.type === "evm") {
				toast.success("EVM address scanned successfully!");
			} else if (result.type === "tron") {
				toast.success("Tron address scanned successfully!");
			}
		}
	}, []);

	const handleAmountChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setAmount(e.target.value);
		},
		[],
	);

	const handleSetMax = useCallback(() => {
		setAmount(balanceFormatted);
	}, [balanceFormatted]);

	const handleCancelGas = useCallback(() => {
		setGasEstimate(null);
	}, []);

	// Memoized calculations to prevent re-renders
	const amountExceedsBalance = useMemo(() => {
		return (
			amount !== "" &&
			amount !== "0" &&
			!Number.isNaN(Number.parseFloat(amount)) &&
			Number.parseFloat(amount) > Number.parseFloat(balanceFormatted)
		);
	}, [amount, balanceFormatted]);

	const tokenPrice = useMemo(
		() =>
			pricesData?.ok && pricesData.prices[token.id]
				? pricesData.prices[token.id].usd
				: null,
		[pricesData, token.id],
	);

	const amountUsd = useMemo(
		() => (tokenPrice && amount ? calculateTokenUsd(amount, tokenPrice) : null),
		[amount, tokenPrice],
	);

	const ethPrice = useMemo(
		() =>
			pricesData?.ok && pricesData.prices.ethereum
				? pricesData.prices.ethereum.usd
				: null,
		[pricesData],
	);

	const totalCost = useMemo(() => {
		if (!gasEstimate?.ok || !amount) return "0";

		if (isTron && isTronGasEstimate(gasEstimate)) {
			return gasEstimate.totalCostTrx;
		}

		if (isEvmGasEstimate(gasEstimate)) {
			return calculateTotalCost(
				isNative ? ethToWei(amount) : amountToRaw(amount, decimals),
				gasEstimate.gasLimit,
				gasEstimate.maxFeePerGas,
			);
		}

		return "0";
	}, [
		gasEstimate,
		amount,
		isTron,
		isNative,
		decimals,
		isEvmGasEstimate,
		isTronGasEstimate,
	]);

	const totalCostEth = useMemo(
		() => (isTron ? totalCost : weiToEth(totalCost)),
		[isTron, totalCost],
	);

	const totalCostUsd = useMemo(
		() =>
			ethPrice && totalCostEth
				? calculateTokenUsd(totalCostEth, ethPrice)
				: null,
		[ethPrice, totalCostEth],
	);

	const hasEnoughBalance = useMemo(
		() =>
			BigInt(balance) >=
			BigInt(isNative ? ethToWei(amount) : amountToRaw(amount, decimals)),
		[balance, amount, isNative, decimals],
	);

	// Estimate gas (memoized with dependencies)
	const estimateGas = useCallback(async () => {
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
				const contractAddress = isNative ? "" : tokenAddress;
				const amountRaw = amountToRaw(amount, decimals);

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
	}, [
		recipient,
		amount,
		isTron,
		tokenAddress,
		decimals,
		address,
		chainId,
		isNative,
		estimateGasMutation,
		estimateErc20GasMutation,
		tronGasEstimateMutation,
	]);

	// Execute the actual transaction (called from sendTransaction or modal)
	const executeTransaction = useCallback(async () => {
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

					// Build and sign the transfer
					const signedTx = isNative
						? await buildAndSignTrxTransfer(
								privateKey as `0x${string}`,
								recipient,
								amountRaw,
							)
						: await buildAndSignTrc20Transfer(
								privateKey as `0x${string}`,
								recipient,
								tokenAddress,
								amountRaw,
							);

					// Broadcast via backend API
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

					// Save transaction to Evolu database
					evolu.insert("transaction", {
						walletId: walletId,
						txHash: result.txHash,
						from: address,
						to: recipient,
						value: amountRaw,
						gasUsed: null,
						maxFeePerGas: "0",
						chainId: "tron",
						status: "pending",
						confirmedAt: null,
					});

					evolu.insert("statement", {
						eoaId: walletId,
						chainId: "tron",
						amount: Number.parseFloat(amount) * -1,
						currency: token.symbol.toUpperCase(),
						timestamp: new Date().toISOString(),
					});

					toast.success("Transaction submitted!");
					navigate(`/transaction/${result.txHash}?chainId=${chainId}`);
				} else {
					// EVM transaction flow
					if (!isEvmGasEstimate(gasEstimate)) {
						toast.error("Invalid gas estimate for EVM transaction");
						return;
					}

					const account = privateKeyToAccount(privateKey as `0x${string}`);

					// Fetch nonce
					const { data: nonceResult } = await transactionCountQuery.refetch();

					if (!nonceResult || !nonceResult.ok) {
						toast.error(
							nonceResult?.error ?? "Failed to fetch transaction count",
						);
						return;
					}

					const amountRaw = isNative
						? ethToWei(amount)
						: amountToRaw(amount, decimals);

					// Sign transaction
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

					// Refresh all address-related queries
					await Promise.all([
						refreshAddressQueries(queryClient, address),
						refreshAddressQueries(queryClient, recipient),
					]);

					// Save transaction to Evolu database
					evolu.insert("transaction", {
						walletId: walletId,
						txHash: result.txHash,
						from: address,
						to: recipient,
						value: amountRaw,
						gasUsed: null,
						maxFeePerGas: gasEstimate.maxFeePerGas,
						chainId: chainId.toString(),
						status: "pending",
						confirmedAt: null,
					});

					evolu.insert("statement", {
						eoaId: walletId,
						chainId: chainId.toString(),
						amount: Number.parseFloat(amount) * -1,
						currency: token.symbol.toUpperCase(),
						timestamp: new Date().toISOString(),
					});

					toast.success("Transaction submitted!");
					navigate(`/transaction/${result.txHash}?chainId=${chainId}`);
				}
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				toast.error(`Failed to send transaction: ${errorMessage}`);
				console.error("Transaction error:", error);
			}
		} finally {
			setIsSending(false);
		}
	}, [
		gasEstimate,
		isTron,
		isEvmGasEstimate,
		isTronGasEstimate,
		encryptedPrivateKey,
		amount,
		decimals,
		recipient,
		address,
		tokenAddress,
		isNative,
		chainId,
		token,
		walletId,
		evolu,
		queryClient,
		broadcastTronTransactionMutation,
		broadcastTransactionMutation,
		transactionCountQuery,
		navigate,
	]);

	// Sign and send transaction (checks safety level first)
	const sendTransaction = useCallback(async () => {
		if (!gasEstimate?.ok) return;

		// Check if address is risky and show modal
		if (safetyLevel === "blocklisted" || safetyLevel === "new") {
			setShowRiskModal(true);
			setIsSending(false);
			return;
		}

		// Safe address - execute directly
		await executeTransaction();
	}, [gasEstimate, safetyLevel, executeTransaction]);

	// Modal handlers
	const handleConfirmRisk = useCallback(() => {
		setShowRiskModal(false);
		executeTransaction();
	}, [executeTransaction]);

	const handleCancelRisk = useCallback(() => {
		setShowRiskModal(false);
	}, []);

	return (
		<div className="max-w-md mx-auto p-4">
			<h1 className="text-2xl font-bold mb-6">Send Crypto</h1>

			{/* Actions - shown at very top when gas estimate exists */}
			{gasEstimate?.ok && (
				<div className="flex gap-2 mb-4">
					<button
						type="button"
						className="btn btn-outline flex-1"
						onClick={handleCancelGas}
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
					onChange={(e) => handleRecipientAddressChange(e.target.value)}
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
								onClick={handleSetMax}
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
					onChange={handleAmountChange}
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
								onClick={handleCancelRisk}
							>
								Cancel
							</button>
							<button
								type="button"
								className="btn btn-error"
								onClick={handleConfirmRisk}
							>
								I understand, proceed
							</button>
						</div>
						<form method="dialog" className="modal-backdrop">
							<button type="button" onClick={handleCancelRisk}>
								Close
							</button>
						</form>
					</div>
				</dialog>
			)}
		</div>
	);
};
