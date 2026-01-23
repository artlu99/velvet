import { sqliteTrue } from "@evolu/common";
import { useEvolu, useQuery } from "@evolu/react";
import { type FC, useEffect, useState } from "react";
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
import { WalletBreadcrumb } from "./WalletBreadcrumb";
import { WalletCarousel } from "./WalletCarousel";

export const WalletManagement: FC = () => {
	const evolu = useEvolu();
	const [showImport, setShowImport] = useState(false);
	const [showDerive, setShowDerive] = useState(false);
	const [activeWalletIndex, setActiveWalletIndex] = useState(0);
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
			await navigator.clipboard.writeText(address);
			setCopiedAddress(address);
			toast.success("Address copied to clipboard!");
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

	// Sync activeWalletIndex when wallet list changes
	// Prevents out-of-bounds index when wallets are deleted
	useEffect(() => {
		if (rows.length === 0) return;
		if (activeWalletIndex >= rows.length) {
			setActiveWalletIndex(rows.length - 1);
		}
	}, [rows.length, activeWalletIndex]);

	// Render individual wallet card
	// Mobile-first: full-screen card on mobile, compact card on desktop with whitespace
	const renderWalletCard = (row: (typeof rows)[number]) => (
		<div
			key={row.id}
			className="card bg-base-200 shadow sm:card-compact overflow-hidden"
		>
			<div className="card-body p-3 overflow-hidden sm:p-3 sm:p-4">
				<div className="flex flex-col items-start justify-between gap-4 min-w-0 sm:flex-row sm:gap-3">
					<div className="flex items-start gap-4 min-w-0 flex-1 sm:gap-3">
						{row.origin === "derived" && (
							<button
								type="button"
								className="btn btn-ghost btn-circle text-base-content/60 sm:btn-xs"
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
									className="fa-solid fa-eye-slash h-6 w-6 sm:h-4 sm:w-4"
									aria-hidden="true"
								/>
							</button>
						)}
						{(row.origin === "imported" || row.origin === "watchOnly") && (
							<button
								type="button"
								className="btn btn-ghost btn-circle text-base-content/60 sm:btn-xs"
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
									className="fa-solid fa-xmark h-6 w-6 sm:h-4 sm:w-4"
									aria-hidden="true"
								/>
							</button>
						)}
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-3 min-w-0 sm:gap-2">
								{row.origin === "watchOnly" && (
									<i
										className="fa-solid fa-eye text-info sm:text-xs"
										title="Watch-only wallet"
										aria-hidden="true"
									/>
								)}
								<h3 className="min-w-0 flex-1 sm:text-sm">
									<EnsOrAddress address={row.address} />
								</h3>
								<button
									type="button"
									className="btn btn-ghost btn-circle sm:btn-xs"
									onClick={() => handleCopyAddress(row.address)}
									aria-label="Copy address"
									title="Copy address"
								>
									{copiedAddress === row.address ? (
										<i
											className="fa-solid fa-check h-6 w-6 text-success sm:h-4 sm:w-4"
											aria-hidden="true"
										/>
									) : (
										<i
											className="fa-solid fa-copy h-6 w-6 sm:h-4 sm:w-4"
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
											className="btn btn-ghost btn-circle sm:btn-xs"
											aria-label="View on Etherscan"
											title="View on Etherscan"
										>
											<i
												className="fa-solid fa-external-link h-6 w-6 sm:h-4 sm:w-4"
												aria-hidden="true"
											/>{" "}
										</a>
										<a
											href={`https://basescan.org/address/${row.address}`}
											target="_blank"
											rel="noopener noreferrer"
											className="btn btn-ghost btn-circle sm:btn-xs"
											aria-label="View on Basescan"
											title="View on Basescan"
										>
											<i
												className="fa-solid fa-external-link h-6 w-6 sm:h-4 sm:w-4"
												aria-hidden="true"
											/>{" "}
										</a>
									</>
								) : row.keyType === "tron" ? (
									<a
										href={`https://tronscan.org/#/address/${row.address}`}
										target="_blank"
										rel="noopener noreferrer"
										className="btn btn-ghost btn-circle sm:btn-xs"
										aria-label="View on TronScan"
										title="View on TronScan"
									>
										<i
											className="fa-solid fa-external-link h-6 w-6 sm:h-4 sm:w-4"
											aria-hidden="true"
										/>{" "}
									</a>
								) : null}
							</div>
							<div className="mt-2 flex gap-2 sm:mt-1 sm:gap-1">
								{row.origin && (
									<div
										className={`badge ${
											row.origin === "watchOnly"
												? "badge-info"
												: "badge-neutral"
										} sm:badge-sm`}
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
									<div className="badge badge-ghost sm:badge-sm">
										{row.keyType.toUpperCase()}
									</div>
								)}
							</div>
							<div className="mt-3 sm:mt-2">
								<WalletBalance address={row.address} />
							</div>
						</div>
					</div>
					<div className="flex gap-3 flex-shrink-0 w-full sm:gap-2 sm:w-auto justify-end">
						{row.origin === "watchOnly" ? (
							<div
								className="tooltip tooltip-bottom"
								data-tip="Watch-only wallets cannot send transactions"
							>
								<button
									type="button"
									className="btn btn-secondary btn-disabled flex items-center justify-center"
									style={{
										minWidth: "3.5rem",
										minHeight: "3.5rem",
									}}
									disabled
									aria-label="Send funds (watch-only wallet)"
								>
									<i
										className="fa-solid fa-paper-plane"
										style={{ fontSize: "1.75rem" }}
										aria-hidden="true"
									/>
								</button>
							</div>
						) : (
							<Link
								href={`/send/${row.address}`}
								className="btn btn-secondary flex items-center justify-center"
								style={{
									minWidth: "3.5rem",
									minHeight: "3.5rem",
								}}
								aria-label="Send funds"
							>
								<i
									className="fa-solid fa-paper-plane"
									style={{ fontSize: "1.75rem" }}
									aria-hidden="true"
								/>
							</Link>
						)}
						<Link
							href={`/receive/${row.address}`}
							className="btn btn-primary flex items-center justify-center"
							style={{
								minWidth: "3.5rem",
								minHeight: "3.5rem",
							}}
							aria-label="Receive funds"
						>
							<i
								className="fa-solid fa-qrcode"
								style={{ fontSize: "1.75rem" }}
								aria-hidden="true"
							/>
						</Link>
					</div>
				</div>
			</div>
		</div>
	);

	return (
		<div className="space-y-2 sm:space-y-6">
			<div className="flex items-center justify-between gap-4">
				{/* Breadcrumb replaces "Accounts" header */}
				{rows.length > 0 && (
					<WalletBreadcrumb
						current={activeWalletIndex + 1}
						total={rows.length}
					/>
				)}
				<div className="join">
					<button
						type="button"
						className={`btn join-item ${
							showDerive ? "btn-active" : "btn-accent"
						}`}
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
						className={`btn join-item ${
							showImport ? "btn-active" : "btn-primary"
						}`}
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

			{rows.length === 0 ? (
				<div className="card card-compact bg-base-200 shadow-xl">
					<div className="card-body text-center">
						<p className="text-gray-500">
							No keys yet. Import one to get started!
						</p>
					</div>
				</div>
			) : (
				<>
					{/* Mobile: Carousel view */}
					<div className="block sm:hidden">
						<WalletCarousel
							wallets={rows as readonly { id: string }[]}
							currentIndex={activeWalletIndex}
							onIndexChange={setActiveWalletIndex}
							renderWallet={(wallet) => renderWalletCard(wallet)}
						/>
					</div>

					{/* Desktop: Existing vertical list */}
					<div className="hidden sm:block space-y-3">
						{rows.map((row) => renderWalletCard(row))}
					</div>
				</>
			)}

			{/* Global portfolio total - below wallet cards */}
			{rows.length > 0 && (
				<GlobalPortfolioTotal addresses={rows.map((row) => row.address)} />
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
