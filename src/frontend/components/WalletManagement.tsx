import { sqliteTrue } from "@evolu/common";
import { useEvolu, useQuery } from "@evolu/react";
import { type FC, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "wouter";
import { createAllEoasQuery } from "~/lib/queries/eoa";
import type { EoaId } from "~/lib/schema";
import { DeleteKeyConfirmation } from "./DeleteKeyConfirmation";
import { DeriveWallet } from "./DeriveWallet";
import { EnsOrAddress } from "./EnsOrAddress";
import { GlobalPortfolioTotal } from "./GlobalPortfolioTotal";
import { ImportPrivateKey } from "./ImportPrivateKey";
import { WalletBalance } from "./WalletBalance";

export const WalletManagement: FC = () => {
	const evolu = useEvolu();
	const [showImport, setShowImport] = useState(false);
	const [showDerive, setShowDerive] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<{
		id: EoaId;
		address: string;
		mode: "delete" | "hide";
		derivationIndex: number | null;
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
		toast.success(
			deleteTarget.mode === "hide" ? "Wallet hidden" : "Private key deleted",
		);
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<h2 className="text-2xl font-bold">Accounts</h2>
				<div className="join">
					<button
						type="button"
						className={`btn join-item ${showDerive ? "btn-active" : "btn-accent"}`}
						onClick={() => {
							setShowDerive(!showDerive);
							setShowImport(false);
						}}
					>
						<i className="fa-solid fa-key mr-2" />
						Derive
					</button>
					<button
						type="button"
						className={`btn join-item ${showImport ? "btn-active" : "btn-primary"}`}
						onClick={() => {
							setShowImport(!showImport);
							setShowDerive(false);
						}}
					>
						Import
						<i className="fa-solid fa-download ml-2" />
					</button>
				</div>
			</div>

			{showDerive && <DeriveWallet />}
			{showImport && <ImportPrivateKey />}

			{/* Global portfolio total */}
			{rows.length > 0 && (
				<GlobalPortfolioTotal addresses={rows.map((row) => row.address)} />
			)}

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
						<div
							key={row.id}
							className="card card-compact bg-base-200 shadow overflow-hidden"
						>
							<div className="card-body p-3 sm:p-4 overflow-hidden">
								<div className="flex flex-col sm:flex-row items-start justify-between gap-3 min-w-0">
									<div className="flex items-start gap-3 min-w-0 flex-1">
										{row.origin === "derived" && (
											<button
												type="button"
												className="btn btn-ghost btn-xs btn-circle text-base-content/60"
												aria-label="Hide wallet"
												onClick={() =>
													setDeleteTarget({
														id: row.id,
														address: row.address,
														mode: "hide",
														derivationIndex: row.derivationIndex,
													})
												}
											>
												<i
													className="fa-solid fa-eye-slash h-4 w-4"
													aria-hidden="true"
												/>
											</button>
										)}
										{(row.origin === "imported" ||
											row.origin === "watchOnly") && (
											<button
												type="button"
												className="btn btn-ghost btn-xs btn-circle text-base-content/60"
												aria-label="Delete wallet"
												onClick={() =>
													setDeleteTarget({
														id: row.id,
														address: row.address,
														mode: "delete",
														derivationIndex: null,
													})
												}
											>
												<i
													className="fa-solid fa-xmark h-4 w-4"
													aria-hidden="true"
												/>
											</button>
										)}
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2 min-w-0">
												{row.origin === "watchOnly" && (
													<i
														className="fa-solid fa-eye text-info text-xs"
														title="Watch-only wallet"
														aria-hidden="true"
													/>
												)}
												<h3 className="text-sm min-w-0 flex-1">
													<EnsOrAddress address={row.address} />
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
												{row.keyType === "evm" ? (
													<>
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
															/>{" "}
														</a>
														<a
															href={`https://basescan.org/address/${row.address}`}
															target="_blank"
															rel="noopener noreferrer"
															className="btn btn-ghost btn-xs btn-circle"
															aria-label="View on Basescan"
															title="View on Basescan"
														>
															<i
																className="fa-solid fa-external-link h-4 w-4"
																aria-hidden="true"
															/>{" "}
														</a>
													</>
												) : row.keyType === "tron" ? (
													<a
														href={`https://tronscan.org/#/address/${row.address}`}
														target="_blank"
														rel="noopener noreferrer"
														className="btn btn-ghost btn-xs btn-circle"
														aria-label="View on TronScan"
														title="View on TronScan"
													>
														<i
															className="fa-solid fa-external-link h-4 w-4"
															aria-hidden="true"
														/>{" "}
													</a>
												) : null}
											</div>
											<div className="mt-1 flex gap-1">
												{row.origin && (
													<div
														className={`badge badge-sm ${row.origin === "watchOnly" ? "badge-info" : "badge-neutral"}`}
													>
														{row.origin === "watchOnly" && (
															<>
																<i className="fa-solid fa-eye mr-1" />
																Watch Only
															</>
														)}
														{row.origin === "imported" && "Imported"}
														{row.origin === "derived" &&
															`Derived: ${row.derivationIndex ?? "?"}`}
													</div>
												)}
												{row.keyType && (
													<div className="badge badge-sm badge-ghost">
														{row.keyType.toUpperCase()}
													</div>
												)}
											</div>
											<div className="mt-2">
												<WalletBalance address={row.address} />
											</div>
										</div>
									</div>
									<div className="flex gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
										{row.origin === "watchOnly" ? (
											<div
												className="tooltip tooltip-bottom"
												data-tip="Watch-only wallets cannot send transactions"
											>
												<button
													type="button"
													className="btn btn-secondary btn-disabled flex items-center justify-center"
													style={{ minWidth: "2.5rem", minHeight: "2.5rem" }}
													disabled
													aria-label="Send funds (watch-only wallet)"
												>
													<i
														className="fa-solid fa-paper-plane"
														style={{ fontSize: "1.5rem" }}
														aria-hidden="true"
													/>
												</button>
											</div>
										) : (
											<Link
												href={`/send/${row.address}`}
												className="btn btn-secondary flex items-center justify-center"
												style={{ minWidth: "2.5rem", minHeight: "2.5rem" }}
												aria-label="Send funds"
											>
												<i
													className="fa-solid fa-paper-plane"
													style={{ fontSize: "1.5rem" }}
													aria-hidden="true"
												/>
											</Link>
										)}
										<Link
											href={`/receive/${row.address}`}
											className="btn btn-primary flex items-center justify-center"
											style={{ minWidth: "2.5rem", minHeight: "2.5rem" }}
											aria-label="Receive funds"
										>
											<i
												className="fa-solid fa-qrcode"
												style={{ fontSize: "1.5rem" }}
												aria-hidden="true"
											/>
										</Link>
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
					mode={deleteTarget.mode}
					derivationIndex={deleteTarget.derivationIndex}
					onConfirm={handleDelete}
					onCancel={() => setDeleteTarget(null)}
				/>
			)}
		</div>
	);
};
