import { useQuery } from "@evolu/react";
import type { SupportedChainId } from "@shared/types";
import { type FC, use, useEffect, useMemo } from "react";
import { formatEther } from "viem";
import { useSearch } from "wouter";
import { EnsOrAddress } from "~/components/EnsOrAddress";
import SpringTransition from "~/components/effects/SpringTransition";
import { useTransactionReceiptQuery } from "~/hooks/queries/useTransactionReceiptQuery";
import { useEvolu } from "~/lib/evolu";
import { createTransactionByHashQuery } from "~/lib/queries/transaction";
import type { TransactionId } from "~/lib/schema";

interface TransactionStatusProps {
	readonly params: { txHash: string };
}

const TransactionStatusContent: FC<TransactionStatusProps> = ({ params }) => {
	const { txHash } = params;
	const search = useSearch();
	const query = new URLSearchParams(search);
	const chainIdParam = query.get("chainId");
	const evolu = useEvolu();

	// Ensure Evolu is initialized before queries (canonical pattern)
	use(evolu.appOwner);

	// Parse chainId
	const chainId: SupportedChainId = useMemo(() => {
		if (chainIdParam === "tron") return "tron";
		if (chainIdParam === "8453") return 8453;
		return 1; // Default to Ethereum
	}, [chainIdParam]);

	// Fetch transaction from Evolu
	const txQuery = createTransactionByHashQuery(evolu, txHash);
	const evoluTx = useQuery(txQuery);
	const tx = evoluTx[0];

	// Poll for transaction receipt if pending (EVM only)
	const isPending = tx?.status === "pending" && chainId !== "tron";
	const { data: receiptData } = useTransactionReceiptQuery({
		txHash,
		chainId,
		enabled: isPending || chainId !== "tron", // Enable for EVM chains
		isPending: isPending ?? false,
	});

	// Update Evolu transaction when receipt is received
	useEffect(() => {
		if (
			receiptData?.ok &&
			tx &&
			tx.status === "pending" &&
			chainId !== "tron"
		) {
			const newStatus =
				receiptData.status === "success" ? "confirmed" : "failed";
			const confirmedAt =
				receiptData.blockTimestamp !== null
					? (new Date(
							receiptData.blockTimestamp * 1000,
						).toISOString() as string)
					: (new Date().toISOString() as string);

			evolu.update("transaction", {
				id: tx.id as TransactionId,
				status: newStatus,
				gasUsed: receiptData.gasUsed,
				confirmedAt: confirmedAt as string & { readonly __brand: "DateIso" },
			});
		}
	}, [receiptData, tx, chainId, evolu]);

	// Determine transaction status
	const status = useMemo(() => {
		if (receiptData?.ok) {
			return receiptData.status === "success" ? "confirmed" : "failed";
		}
		return tx?.status ?? "pending";
	}, [receiptData, tx]);

	// Determine explorer URL and name based on chain
	const { explorerUrl, explorerName } = useMemo(() => {
		if (chainId === "tron") {
			return {
				explorerUrl: `https://tronscan.org/#/transaction/${txHash}`,
				explorerName: "TronScan",
			};
		}
		if (chainId === 8453) {
			return {
				explorerUrl: `https://basescan.org/tx/${txHash}`,
				explorerName: "Basescan",
			};
		}
		return {
			explorerUrl: `https://etherscan.io/tx/${txHash}`,
			explorerName: "Etherscan",
		};
	}, [chainId, txHash]);

	// Status icon and message
	const statusConfig = useMemo(() => {
		if (status === "confirmed") {
			return {
				icon: "fa-circle-check",
				color: "text-success",
				title: "Transaction Confirmed",
				message: "Your transaction has been confirmed on the network.",
			};
		}
		if (status === "failed") {
			return {
				icon: "fa-circle-xmark",
				color: "text-error",
				title: "Transaction Failed",
				message: "Your transaction failed to execute.",
			};
		}
		return {
			icon: "fa-circle-notch",
			color: "text-warning",
			title: "Transaction Pending",
			message:
				"Your transaction has been submitted to the network. It may take a few minutes to be confirmed.",
		};
	}, [status]);

	return (
		<div className="max-w-md mx-auto p-4">
			<SpringTransition isActive={true} skipExit={true}>
				<div className="text-center py-12">
					<div className="mb-6">
						<i
							className={`fa-solid ${statusConfig.icon} ${statusConfig.color} text-6xl ${
								status === "pending" ? "animate-spin" : ""
							}`}
							aria-hidden="true"
						/>
					</div>
					<h1 className="text-2xl font-bold mb-4">{statusConfig.title}</h1>

					{/* Transaction Details Card */}
					{tx && (
						<div className="card bg-base-200 mb-6">
							<div className="card-body">
								<div className="space-y-3 text-sm">
									<div className="flex justify-between items-start">
										<span className="opacity-70">From:</span>
										<span className="text-right">
											<EnsOrAddress address={tx.from} />
										</span>
									</div>
									<div className="flex justify-between items-start">
										<span className="opacity-70">To:</span>
										<span className="text-right">
											<EnsOrAddress address={tx.to} />
										</span>
									</div>
									<div className="flex justify-between items-start">
										<span className="opacity-70">Value:</span>
										<span className="font-mono">
											{formatEther(BigInt(String(tx.value)))} ETH
										</span>
									</div>
									{tx.gasUsed && (
										<div className="flex justify-between items-start">
											<span className="opacity-70">Gas Used:</span>
											<span className="font-mono">{tx.gasUsed}</span>
										</div>
									)}
									{receiptData?.ok && (
										<div className="flex justify-between items-start">
											<span className="opacity-70">Block:</span>
											<span className="font-mono">
												{receiptData.blockNumber}
											</span>
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					<div className="bg-base-200 rounded-lg p-4 mb-6">
						<div className="text-sm opacity-70 mb-1">Transaction Hash</div>
						<div className="font-mono text-sm break-all">{txHash}</div>
					</div>

					<div className="space-y-2">
						<a
							href={explorerUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="btn btn-outline btn-sm w-full"
						>
							<i
								className="fa-solid fa-external-link-alt mr-2"
								aria-hidden="true"
							/>
							View on {explorerName}
						</a>
					</div>

					<div className="mt-6 text-sm opacity-70">
						<p>{statusConfig.message}</p>
					</div>
				</div>
			</SpringTransition>
		</div>
	);
};

export const TransactionStatus: FC<TransactionStatusProps> = (props) => {
	return (
		<SpringTransition isActive={true}>
			<TransactionStatusContent {...props} />
		</SpringTransition>
	);
};
