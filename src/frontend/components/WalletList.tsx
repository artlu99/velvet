import { useQuery } from "@evolu/react";
import { sort } from "radash";
import type { FC } from "react";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { DeleteKeyConfirmation } from "~/components/DeleteKeyConfirmation";
import { DeriveWallet } from "~/components/DeriveWallet";
import { ImportPrivateKey } from "~/components/ImportPrivateKey";
import { SortableWalletList } from "~/components/SortableWalletList";
import { WalletBreadcrumb } from "~/components/WalletBreadcrumb";
import { WalletCardWrapper } from "~/components/WalletCardWrapper";
import { WalletCarousel } from "~/components/WalletCarousel";
import { WalletStats } from "~/components/WalletStats";
import { documentationLinks } from "~/lib/documentation-links";
import { type EoaRow, validateEoaRowArray } from "~/lib/eoaValidation";
import { useEvolu } from "~/lib/evolu";
import { allEoasQuery } from "~/lib/queries/eoa";
import { reorderWallets } from "~/lib/queries/walletOrdering";

interface WalletListProps {
	showImport: boolean;
	showDerive: boolean;
	activeWalletIndex: number;
	deleteTarget: EoaRow | null;
	onToggleImport: () => void;
	onToggleDerive: () => void;
	setActiveWalletIndex: (index: number) => void;
	onDeleteClick: (row: EoaRow) => void;
	onCopyAddress: (address: string) => void;
	copiedText: string | null;
	onDelete: () => void;
	onResetDeleteTarget: () => void;
	lastClickTimeRef: React.MutableRefObject<number>;
}

/**
 * Component that handles the Evolu query, validation, sorting, and rendering.
 * Moved from render prop pattern to direct rendering to fix Suspense resolution.
 */
export const WalletList: FC<WalletListProps> = ({
	showImport,
	showDerive,
	activeWalletIndex,
	deleteTarget,
	onToggleImport,
	onToggleDerive,
	setActiveWalletIndex,
	onDeleteClick,
	onCopyAddress,
	copiedText,
	onDelete,
	onResetDeleteTarget,
	lastClickTimeRef,
}) => {
	// Get Evolu instance for mutations
	const evolu = useEvolu();

	// Canonical Evolu pattern: useQuery with module-level query
	const rowsRawUnvalidated = useQuery(allEoasQuery) ?? [];

	// Validate with valibot to catch data corruption and type mismatches
	const validatedRows = validateEoaRowArray(rowsRawUnvalidated);

	// Sort in JavaScript: orderIndex ASC, then createdAt DESC (nulls last)
	const rows = sort(
		validatedRows,
		(wallet) => {
			const orderValue = wallet.orderIndex ?? Number.POSITIVE_INFINITY;
			let createdAtTimestamp = 0;
			try {
				if (wallet.createdAt) {
					const date = new Date(wallet.createdAt);
					if (!Number.isNaN(date.getTime())) {
						createdAtTimestamp = date.getTime();
					}
				}
			} catch (err) {
				console.warn("WalletList: Invalid createdAt for wallet", {
					id: wallet.id,
					createdAt: wallet.createdAt,
					error: err,
				});
			}
			return orderValue * 1_000_000_000 - createdAtTimestamp;
		},
		false,
	) as readonly EoaRow[];

	// Sync activeWalletIndex when wallet list changes
	if (rows.length > 0 && activeWalletIndex >= rows.length) {
		setActiveWalletIndex(rows.length - 1);
	}

	// Handle wallet reordering from drag-and-drop
	// Wrapped in useCallback to prevent unnecessary re-renders of SortableWalletList
	// rows passed as parameter to avoid capturing in closure
	const handleReorder = useCallback(
		async (wallets: readonly EoaRow[], oldIndex: number, newIndex: number) => {
			try {
				await reorderWallets(evolu, wallets, oldIndex, newIndex);
				toast.success("Wallet order updated");
			} catch (error) {
				console.error("Failed to reorder wallets:", error);
				toast.error("Failed to update wallet order");
			}
		},
		[evolu],
	);

	return (
		<>
			<div className="flex items-center justify-between gap-4">
				{rows.length > 0 && (
					<WalletBreadcrumb
						current={activeWalletIndex + 1}
						total={rows.length}
					/>
				)}
				<div className="join">
					<button
						type="button"
						className={`btn join-item ${showDerive ? "btn-active" : "btn-accent"}`}
						onClick={onToggleDerive}
					>
						<i className="fa-solid fa-key mr-2" />
						Derive
					</button>
					<button
						type="button"
						className={`btn join-item ${showImport ? "btn-active" : "btn-primary"}`}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							const now = Date.now();
							if (now - lastClickTimeRef.current < 300) {
								return;
							}
							lastClickTimeRef.current = now;
							onToggleImport();
						}}
					>
						Import
						<i className="fa-solid fa-download ml-2" />
					</button>
				</div>
			</div>
			{showDerive && (
				<div className="mb-4" key="derive">
					<DeriveWallet />
				</div>
			)}
			<div className={`mb-4 ${showImport ? "block" : "hidden"}`}>
				<ImportPrivateKey />
			</div>
			{rows.length === 0 ? (
				<div className="space-y-4">
					<div className="card card-compact bg-base-200 shadow-xl">
						<div className="card-body text-center prose dark:prose-invert">
							<p>Derive or Import an account to get started!</p>
							<ul className="menu menu-vertical gap-1">
								{documentationLinks.map((link) => (
									<li key={link.href}>
										<a
											href={link.href}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-3 no-underline"
										>
											<i className={link.icon} aria-hidden="true" />
											{link.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			) : (
				<>
					{/* Mobile: Carousel view */}
					<WalletCarousel
						wallets={rows}
						currentIndex={activeWalletIndex}
						onIndexChange={setActiveWalletIndex}
						renderWallet={(row) => (
							<WalletCardWrapper
								key={row.id}
								row={row}
								onDelete={onDeleteClick}
								onCopyAddress={onCopyAddress}
								copiedText={copiedText}
							/>
						)}
					/>

					{/* Desktop: Draggable list view */}
					<div className="hidden sm:block space-y-4">
						<SortableWalletList
							wallets={rows}
							onReorder={(oldIndex, newIndex) =>
								handleReorder(rows, oldIndex, newIndex)
							}
							onDelete={onDeleteClick}
							onCopyAddress={onCopyAddress}
							copiedText={copiedText}
						/>
						<div className="hidden sm:flex justify-center">
							<WalletStats wallets={rows} />
						</div>
					</div>
				</>
			)}
			{deleteTarget?.address && (
				<DeleteKeyConfirmation
					address={deleteTarget.address}
					mode={deleteTarget.origin === "derived" ? "hide" : "delete"}
					derivationIndex={deleteTarget.derivationIndex}
					onConfirm={onDelete}
					onCancel={onResetDeleteTarget}
				/>
			)}
		</>
	);
};
