import { useQuery } from "@evolu/react";
import type { SupportedChainId } from "@shared/types";
import { type FC, Suspense, use, useEffect, useMemo, useState } from "react";
import { formatEther, isAddress } from "viem";
import { Link, useParams, useSearch } from "wouter";
import { AddressSafetyBadge } from "~/components/AddressSafetyBadge";
import { EnsOrAddress } from "~/components/EnsOrAddress";
import { useAddressReputationQuery } from "~/hooks/queries/useAddressReputationQuery";
import { useTransactionHistoryQuery } from "~/hooks/queries/useTransactionHistoryQuery";
import { useEvolu } from "~/lib/evolu";
import { formatUsd } from "~/lib/helpers";
import {
	getBlocklistReason,
	isAddressBlocklisted,
} from "~/lib/queries/blocklist";
import { allEoasQuery } from "~/lib/queries/eoa";

const AddressDetailsContent: FC = () => {
	const { address: addressParam } = useParams<{ address?: string }>();
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

	// Get all wallets to find the current wallet
	const allWallets = useQuery(allEoasQuery) ?? [];
	const currentWallet =
		allWallets.find((w) => w.isSelected === 1) ?? allWallets[0];

	// Validate address - use validated address or empty string
	const address = addressParam && isAddress(addressParam) ? addressParam : "";
	const isValidAddress = !!address && isAddress(address);

	// Fetch transaction history for incoming transactions (EVM only)
	const { data: transactionHistoryData } = useTransactionHistoryQuery({
		address,
		chainId,
		enabled: isValidAddress && chainId !== "tron",
	});

	// Extract incoming transactions
	const incomingTxs = useMemo(() => {
		if (!transactionHistoryData?.ok || !currentWallet?.address || !address)
			return undefined;
		return transactionHistoryData.data
			.filter(
				(tx) =>
					tx.to?.toLowerCase() === currentWallet.address?.toLowerCase() &&
					tx.from.toLowerCase() === address.toLowerCase(),
			)
			.map((tx) => ({
				from: tx.from,
				value: tx.value,
				timestamp: tx.timeStamp,
			}));
	}, [transactionHistoryData, currentWallet?.address, address]);

	// Fetch address reputation with incoming transactions
	const addressReputationQuery = useAddressReputationQuery({
		walletId: currentWallet?.id ?? "",
		address: isValidAddress ? address : null,
		incomingTxs,
		enabled: !!currentWallet?.id && isValidAddress,
	});

	// Use address reputation query (already includes incoming transactions)
	const fullReputation = addressReputationQuery.data;

	// Check blocklist status
	const [isBlocklisted, setIsBlocklisted] = useState(false);
	const [blocklistReason, setBlocklistReason] = useState<string | null>(null);

	useEffect(() => {
		async function checkBlocklist() {
			if (isValidAddress) {
				const blocked = await isAddressBlocklisted(address);
				setIsBlocklisted(blocked);
				if (blocked) {
					const reason = await getBlocklistReason(address);
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
	}, [address, isValidAddress]);

	// Determine safety level (must be before early return - Rules of Hooks)
	const safetyLevel = useMemo(() => {
		if (isBlocklisted) return "blocklisted";
		if (fullReputation?.safetyLevel) return fullReputation.safetyLevel;
		return "new";
	}, [isBlocklisted, fullReputation]);

	// Determine explorer URL (must be before early return - Rules of Hooks)
	const explorerUrl = useMemo(() => {
		if (chainId === "tron") {
			return `https://tronscan.org/#/address/${address}`;
		}
		if (chainId === 8453) {
			return `https://basescan.org/address/${address}`;
		}
		return `https://etherscan.io/address/${address}`;
	}, [chainId, address]);

	const explorerName = useMemo(() => {
		if (chainId === "tron") return "TronScan";
		if (chainId === 8453) return "Basescan";
		return "Etherscan";
	}, [chainId]);

	// Validate address - early return after all hooks
	if (!addressParam || !isValidAddress) {
		return (
			<div className="max-w-4xl mx-auto p-4">
				<div className="card bg-base-200">
					<div className="card-body text-center py-12">
						<h2 className="text-xl font-bold mb-4">Invalid Address</h2>
						<p className="text-sm opacity-70 mb-4">
							The provided address is not a valid Ethereum address.
						</p>
						<Link href="/" className="btn btn-primary">
							Go to Wallets
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto p-4">
			<div className="mb-6">
				<Link href="/" className="btn btn-ghost btn-sm">
					<i className="fa-solid fa-arrow-left" />
					Back
				</Link>
			</div>

			{/* Address Header */}
			<div className="card bg-base-200 mb-6">
				<div className="card-body">
					<div className="flex items-center justify-between mb-4">
						<h1 className="text-2xl font-bold">Address Details</h1>
						{safetyLevel && (
							<AddressSafetyBadge
								safetyLevel={safetyLevel}
								interactionCount={fullReputation?.interactionCount}
								blocklistReason={blocklistReason}
							/>
						)}
					</div>
					<div className="font-mono text-sm break-all mb-4">
						<EnsOrAddress address={address} />
					</div>
					<div className="flex gap-2">
						<a
							href={explorerUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="btn btn-outline btn-sm"
						>
							<i className="fa-solid fa-external-link-alt" />
							View on {explorerName}
						</a>
					</div>
				</div>
			</div>

			{/* Statistics */}
			{fullReputation && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
					<div className="stat bg-base-200 rounded-lg">
						<div className="stat-title">Interactions</div>
						<div className="stat-value text-2xl">
							{fullReputation.interactionCount}
						</div>
						<div className="stat-desc">
							{fullReputation.interactionCount === 1
								? "transaction"
								: "transactions"}
						</div>
					</div>
					<div className="stat bg-base-200 rounded-lg">
						<div className="stat-title">Total Sent</div>
						<div className="stat-value text-2xl">
							{formatEther(BigInt(fullReputation.totalSent))}
						</div>
						<div className="stat-desc">ETH</div>
					</div>
					{fullReputation.firstInteraction && (
						<div className="stat bg-base-200 rounded-lg">
							<div className="stat-title">First Interaction</div>
							<div className="stat-value text-lg">
								{new Date(fullReputation.firstInteraction).toLocaleDateString()}
							</div>
						</div>
					)}
					{fullReputation.lastInteraction && (
						<div className="stat bg-base-200 rounded-lg">
							<div className="stat-title">Last Interaction</div>
							<div className="stat-value text-lg">
								{new Date(fullReputation.lastInteraction).toLocaleDateString()}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Transaction History */}
			{transactionHistoryData?.ok && transactionHistoryData.data.length > 0 && (
				<div className="card bg-base-200">
					<div className="card-body">
						<h2 className="card-title mb-4">Recent Transactions</h2>
						<div className="overflow-x-auto">
							<table className="table table-zebra">
								<thead>
									<tr>
										<th>Hash</th>
										<th>From</th>
										<th>To</th>
										<th>Value</th>
										<th>Date</th>
									</tr>
								</thead>
								<tbody>
									{transactionHistoryData.data.slice(0, 10).map((tx) => (
										<tr key={tx.hash}>
											<td>
												<Link
													href={`/transaction/${tx.hash}?chainId=${chainId}`}
													className="link link-primary font-mono text-xs"
												>
													{tx.hash.slice(0, 10)}...
												</Link>
											</td>
											<td className="font-mono text-xs">
												<EnsOrAddress address={tx.from} />
											</td>
											<td className="font-mono text-xs">
												{tx.to ? <EnsOrAddress address={tx.to} /> : "-"}
											</td>
											<td>
												{formatEther(BigInt(tx.value))} ETH
												{tx.estimatedUsdValue > 0 && (
													<div className="text-xs opacity-70">
														≈${formatUsd.format(tx.estimatedUsdValue)}
													</div>
												)}
											</td>
											<td className="text-xs">
												{new Date(
													Number.parseInt(tx.timeStamp, 10) * 1000,
												).toLocaleDateString()}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export const AddressDetails: FC = () => {
	return (
		<Suspense
			fallback={
				<div className="max-w-4xl mx-auto p-4">
					<div className="loading loading-spinner mx-auto" />
				</div>
			}
		>
			<AddressDetailsContent />
		</Suspense>
	);
};
