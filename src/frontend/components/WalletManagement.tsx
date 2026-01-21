import { sqliteTrue } from "@evolu/common";
import { useEvolu, useQuery } from "@evolu/react";
import { type FC, useState } from "react";
import toast from "react-hot-toast";
import { createAllEoasQuery } from "~/lib/queries/eoa";
import type { EoaId } from "~/lib/schema";
import { DeleteKeyConfirmation } from "./DeleteKeyConfirmation";
import { ImportPrivateKey } from "./ImportPrivateKey";

export const WalletManagement: FC = () => {
	const evolu = useEvolu();
	const [showImport, setShowImport] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<{
		id: EoaId;
		address: string;
	} | null>(null);
	const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

	const allEoas = createAllEoasQuery(evolu);

	const rows = useQuery(allEoas);

	const handleCopyAddress = async (address: string) => {
		try {
			// Use modern Clipboard API
			await navigator.clipboard.writeText(address);
			setCopiedAddress(address);
			toast.success("Address copied to clipboard!");
			// Clear the "copied" state after 2 seconds
			setTimeout(() => setCopiedAddress(null), 2000);
		} catch (error) {
			toast.error("Failed to copy address");
			console.error("Clipboard error:", error);
		}
	};

	const handleDelete = () => {
		if (!deleteTarget) return;

		evolu.update("eoa", {
			id: deleteTarget.id,
			isDeleted: sqliteTrue,
		});

		setDeleteTarget(null);
		toast.success("Private key deleted");
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold">Your Wallet</h2>
				<button
					type="button"
					className="btn btn-primary"
					onClick={() => setShowImport(!showImport)}
				>
					{showImport ? "Cancel" : "Import Private Key"}
				</button>
			</div>

			{showImport && <ImportPrivateKey />}

			{rows.length === 0 ? (
				<div className="card card-compact bg-base-200 shadow-xl">
					<div className="card-body text-center">
						<p className="text-gray-500">
							No keys yet. Import one to get started!
						</p>
					</div>
				</div>
			) : (
				<div className="space-y-3">
					{rows.map((row) => (
						<div key={row.id} className="card card-compact bg-base-200 shadow">
							<div className="card-body">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<h3 className="font-mono text-sm">
												{row.address.slice(0, 6)}...
												{row.address.slice(-4)}
											</h3>
											<button
												type="button"
												className="btn btn-ghost btn-xs btn-circle"
												onClick={() => handleCopyAddress(row.address)}
												aria-label="Copy address"
												title="Copy address"
											>
												{copiedAddress === row.address ? (
													<i
														className="fa-solid fa-check h-4 w-4 text-success"
														aria-hidden="true"
													/>
												) : (
													<i
														className="fa-solid fa-copy h-4 w-4"
														aria-hidden="true"
													/>
												)}
											</button>
											{/** biome-ignore lint/a11y/useAnchorContent: aria label is used */}
											<a
												href={`https://etherscan.io/address/${row.address}`}
												target="_blank"
												rel="noopener noreferrer"
												className="btn btn-ghost btn-xs btn-circle"
												aria-label="View on Etherscan"
												title="View on Etherscan"
											>
												<i
													className="fa-solid fa-external-link h-4 w-4"
													aria-hidden="true"
												/>
											</a>
										</div>
										<div className="flex gap-1">
											{row.origin && (
												<div className="badge badge-sm badge-neutral">
													{row.origin === "imported" ? "Imported" : "Derived"}
												</div>
											)}
											{row.keyType && (
												<div className="badge badge-sm badge-ghost">
													{row.keyType.toUpperCase()}
												</div>
											)}
										</div>
									</div>
									<div className="flex gap-2 sm:flex-row">
										{row.origin === "imported" && (
											<button
												type="button"
												className="btn btn-error btn-sm"
												onClick={() =>
													setDeleteTarget({
														id: row.id,
														address: row.address,
													})
												}
											>
												Delete
											</button>
										)}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{deleteTarget && (
				<DeleteKeyConfirmation
					address={deleteTarget.address}
					onConfirm={handleDelete}
					onCancel={() => setDeleteTarget(null)}
				/>
			)}
		</div>
	);
};
