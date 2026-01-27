import { sqliteTrue } from "@evolu/common";
import { type FC, use, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "wouter";
import { EnsOrAddress } from "~/components/EnsOrAddress";
import { WalletBalance } from "~/components/WalletBalance";
import { WalletList } from "~/components/WalletList";
import { useClipboardWithTimeout } from "~/hooks/useClipboardWithTimeout";
import type { EoaRow } from "~/lib/eoaValidation";
import { useEvolu } from "~/lib/evolu";
import {
	CLIPBOARD_TIMEOUT_MS,
	ZERO_ADDRESS_EVM,
	ZERO_ADDRESS_TRON,
} from "~/lib/helpers";

// Wrapper component to fetch labels/tags for each wallet card
interface WalletCardWrapperProps {
	row: EoaRow;
	onDelete: (row: EoaRow) => void;
	onCopyAddress: (address: string) => void;
	copiedText: string | null;
}

export const WalletCardWrapper: FC<WalletCardWrapperProps> = ({
	row,
	onDelete,
	onCopyAddress,
	copiedText,
}) => {
	const origin = row.origin;
	const keyType = row.keyType;
	const address = row.address ?? "";

	return (
		<div className="card bg-base-200 shadow card-compact overflow-hidden">
			<div className="card-body p-4">
				<div className="flex items-stretch gap-3 min-w-0">
					{origin === "derived" && (
						<button
							type="button"
							className="btn btn-ghost btn-circle btn-xs text-base-content/60"
							aria-label="Hide wallet"
							onClick={() => onDelete(row)}
						>
							<i className="fa-solid fa-eye-slash h-4 w-4" aria-hidden="true" />
						</button>
					)}
					{(origin === "imported" || origin === "watchOnly") && (
						<button
							type="button"
							className="btn btn-ghost btn-circle btn-xs text-base-content/60"
							aria-label="Delete wallet"
							onClick={() => onDelete(row)}
						>
							<i className="fa-solid fa-xmark h-4 w-4" aria-hidden="true" />
						</button>
					)}
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2 min-w-0">
							{origin === "watchOnly" && (
								<i
									className="fa-solid fa-eye text-info text-xs"
									title="Watch-only wallet"
									aria-hidden="true"
								/>
							)}
							<h3 className="min-w-0 flex-1 text-sm">
								{address ? (
									<EnsOrAddress address={address} />
								) : (
									<span className="text-base-content/60">No address</span>
								)}
							</h3>
							<button
								type="button"
								className="btn btn-ghost btn-circle btn-xs"
								onClick={() => onCopyAddress(address)}
								aria-label="Copy address"
								title="Copy address"
							>
								{copiedText === address ? (
									<i
										className="fa-solid fa-check h-4 w-4 text-success"
										aria-hidden="true"
									/>
								) : (
									<i className="fa-solid fa-copy h-4 w-4" aria-hidden="true" />
								)}
							</button>
							{keyType === "evm" ? (
								<>
									<a
										href={`https://etherscan.io/address/${row.address ?? ""}`}
										target="_blank"
										rel="noopener noreferrer"
										className="btn btn-ghost btn-circle btn-xs"
										aria-label="View on Etherscan"
										title="View on Etherscan"
									>
										<i
											className="fa-solid fa-external-link h-4 w-4"
											aria-hidden="true"
										/>
										<span className="sr-only">View on Etherscan</span>
									</a>
									<a
										href={`https://basescan.org/address/${row.address ?? ""}`}
										target="_blank"
										rel="noopener noreferrer"
										className="btn btn-ghost btn-circle btn-xs"
										aria-label="View on Basescan"
										title="View on Basescan"
									>
										<i
											className="fa-solid fa-external-link h-4 w-4"
											aria-hidden="true"
										/>
										<span className="sr-only">View on Basescan</span>
									</a>
								</>
							) : keyType === "tron" ? (
								<a
									href={`https://tronscan.org/#/address/${row.address ?? ""}`}
									target="_blank"
									rel="noopener noreferrer"
									className="btn btn-ghost btn-circle btn-xs"
									aria-label="View on TronScan"
									title="View on TronScan"
								>
									<i
										className="fa-solid fa-external-link h-4 w-4"
										aria-hidden="true"
									/>
									<span className="sr-only">View on TronScan</span>
								</a>
							) : null}
						</div>
						<div className="mt-1 flex gap-1">
							{origin && (
								<div
									className={`badge badge-sm ${
										origin === "watchOnly" ? "badge-info" : "badge-neutral"
									}`}
								>
									{origin === "watchOnly" && (
										<>
											<i className="fa-solid fa-eye mr-1" />
											Watch Only
										</>
									)}
									{origin === "imported" && "Imported"}
									{origin === "derived" &&
										`Derived: ${row.derivationIndex ?? "?"}`}
								</div>
							)}
							{row.keyType && (
								<div className="badge badge-ghost badge-sm">
									{keyType?.toUpperCase()}
								</div>
							)}
						</div>
						<div className="mt-2">
							<WalletBalance address={address} />
						</div>
					</div>
				</div>
				<div className="flex mt-4 justify-center gap-8 w-full">
					<Link
						href={`/receive/${row.address ?? ""}`}
						className="btn btn-primary flex flex-col items-center justify-center gap-1"
						style={{ minWidth: "4.5rem", minHeight: "4.5rem" }}
						aria-label="Receive funds"
					>
						<i
							className="fa-solid fa-qrcode"
							style={{ fontSize: "1.75rem" }}
							aria-hidden="true"
						/>
						<span className="text-xs">Receive</span>
					</Link>
					{origin === "watchOnly" ? (
						<button
							type="button"
							className="btn btn-secondary btn-disabled flex flex-col items-center justify-center gap-1"
							style={{ minWidth: "4.5rem", minHeight: "4.5rem" }}
							disabled
							aria-label="Send funds (watch-only wallet)"
						>
							<i
								className="fa-solid fa-paper-plane"
								style={{ fontSize: "1.75rem" }}
								aria-hidden="true"
							/>
							<span className="text-xs">Send</span>
						</button>
					) : (
						<Link
							href={`/send/${row.address ?? ""}`}
							className="btn btn-secondary flex flex-col items-center justify-center gap-1"
							style={{ minWidth: "4.5rem", minHeight: "4.5rem" }}
							aria-label="Send funds"
						>
							<i
								className="fa-solid fa-paper-plane"
								style={{ fontSize: "1.75rem" }}
								aria-hidden="true"
							/>
							<span className="text-xs">Send</span>
						</Link>
					)}
				</div>
			</div>
		</div>
	);
};

export const WalletManagement: FC = () => {
	const evolu = useEvolu();

	// Ensure Evolu is initialized before queries (canonical pattern)
	use(evolu.appOwner);

	const [deleteTarget, setDeleteTarget] = useState<EoaRow | null>(null);
	const [showImport, setShowImport] = useState(false);
	const [showDerive, setShowDerive] = useState(false);
	const [activeWalletIndex, setActiveWalletIndex] = useState(0);

	const { copyToClipboard, copiedText } =
		useClipboardWithTimeout(CLIPBOARD_TIMEOUT_MS);

	const lastClickTimeRef = useRef(0);

	const handleCopyAddress = async (address: string) => {
		try {
			await copyToClipboard(address);
			toast.success("Address copied to clipboard!");
		} catch (error) {
			toast.error("Failed to copy address");
			console.error("Clipboard error:", error);
		}
	};

	const handleDelete = () => {
		if (!deleteTarget) return;

		const isImportedOrWatchOnly =
			deleteTarget.origin === "imported" || deleteTarget.origin === "watchOnly";

		if (isImportedOrWatchOnly) {
			// Sanitize data with sentinel values (defense-in-depth)
			const zeroAddress =
				deleteTarget.keyType === "tron" ? ZERO_ADDRESS_TRON : ZERO_ADDRESS_EVM;

			evolu.update("eoa", {
				id: deleteTarget.id,
				isDeleted: sqliteTrue,
				address: zeroAddress,
				encryptedPrivateKey: zeroAddress,
			});
		} else {
			// Derived wallets: just hide (can be re-derived from mnemonic)
			evolu.update("eoa", {
				id: deleteTarget.id,
				isDeleted: sqliteTrue,
			});
		}

		setDeleteTarget(null);
		const mode = deleteTarget.origin === "derived" ? "hide" : "delete";
		toast.success(mode === "hide" ? "Wallet hidden" : "Private key deleted");
	};

	// Note: activeWalletIndex sync moved into WalletList render prop

	// Handler for delete button in wallet cards
	const handleDeleteClick = (row: EoaRow) => {
		setDeleteTarget(row);
	};

	return (
		<div className="space-y-2 sm:space-y-8">
			<WalletList
				showImport={showImport}
				showDerive={showDerive}
				activeWalletIndex={activeWalletIndex}
				deleteTarget={deleteTarget}
				onToggleImport={() => setShowImport(!showImport)}
				onToggleDerive={() => setShowDerive(!showDerive)}
				setActiveWalletIndex={setActiveWalletIndex}
				onDeleteClick={handleDeleteClick}
				onCopyAddress={handleCopyAddress}
				copiedText={copiedText}
				onDelete={handleDelete}
				onResetDeleteTarget={() => setDeleteTarget(null)}
				lastClickTimeRef={lastClickTimeRef}
			/>
		</div>
	);
};
