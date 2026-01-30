import { sqliteTrue } from "@evolu/common";
import { type FC, use, useRef, useState } from "react";
import toast from "react-hot-toast";
import { WalletList } from "~/components/WalletList";
import { useClipboardWithTimeout } from "~/hooks/useClipboardWithTimeout";
import type { EoaRow } from "~/lib/eoaValidation";
import { useEvolu } from "~/lib/evolu";
import {
	CLIPBOARD_TIMEOUT_MS,
	ZERO_ADDRESS_EVM,
	ZERO_ADDRESS_TRON,
} from "~/lib/helpers";

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
		<div className="container mx-auto px-4 max-w-4xl space-y-4 sm:space-y-10">
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
		</div>
	);
};
