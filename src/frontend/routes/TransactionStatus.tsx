import type { FC } from "react";
import { useSearch } from "wouter";

interface TransactionStatusProps {
	readonly params: { txHash: string };
}

export const TransactionStatus: FC<TransactionStatusProps> = ({ params }) => {
	const { txHash } = params;
	const search = useSearch();
	const query = new URLSearchParams(search);
	const chainId = query.get("chainId");

	const isBase = chainId === "8453";
	const explorerUrl = isBase
		? `https://basescan.org/tx/${txHash}`
		: `https://etherscan.io/tx/${txHash}`;
	const explorerName = isBase ? "Basescan" : "Etherscan";

	// TODO: Fetch transaction details from Evolu database
	// For now, just display the hash

	return (
		<div className="max-w-md mx-auto p-4">
			<div className="text-center py-12">
				<div className="mb-6">
					<i
						className="fa-solid fa-circle-check text-success text-6xl"
						aria-hidden="true"
					/>
				</div>
				<h1 className="text-2xl font-bold mb-4">Transaction Submitted</h1>

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
					<p>
						Your transaction has been submitted to the network. It may take a
						few minutes to be confirmed.
					</p>
				</div>
			</div>
		</div>
	);
};
