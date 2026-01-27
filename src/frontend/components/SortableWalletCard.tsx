import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FC } from "react";
import { Link } from "wouter";
import { EnsOrAddress } from "~/components/EnsOrAddress";
import { WalletBalance } from "~/components/WalletBalance";
import type { EoaRow } from "~/lib/eoaValidation";

interface SortableWalletCardProps {
	readonly id: string; // wallet.id for @dnd-kit
	readonly row: EoaRow;
	readonly onDelete: (row: EoaRow) => void;
	readonly onCopyAddress: (address: string) => void;
	readonly copiedText: string | null;
}

/**
 * Draggable wallet card component with drag handle (desktop only).
 * Wraps wallet card with @dnd-kit sortable functionality.
 */
export const SortableWalletCard: FC<SortableWalletCardProps> = ({
	id,
	row,
	onDelete,
	onCopyAddress,
	copiedText,
}) => {
	const {
		setNodeRef,
		transform,
		transition,
		isDragging,
		attributes,
		listeners,
	} = useSortable({ id });

	const origin = row.origin;
	const keyType = row.keyType;
	const address = row.address ?? "";

	// Apply drag styles to the card
	const cardStyle = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			className="card bg-base-200 shadow card-compact overflow-hidden"
			ref={setNodeRef}
			style={cardStyle}
		>
			<div className="card-body p-4">
				<div className="flex items-stretch gap-3">
					{/* Drag handle - desktop only */}
					<div className="hidden sm:flex items-center gap-3">
						{/* Vertical separator bar */}
						<div className="w-px bg-base-content/20" />
						{/* Drag handle */}
						<button
							type="button"
							className="btn btn-ghost btn-circle btn-xs text-base-content/50 cursor-grab active:cursor-grabbing hover:text-base-content/70 transition-colors"
							aria-label="Drag to reorder wallet"
							{...attributes}
							{...listeners}
						>
							<i
								className="fa-solid fa-grip-vertical h-4 w-4"
								aria-hidden="true"
							/>
						</button>
						{/* Vertical separator bar */}
						<div className="w-px bg-base-content/20 h-full" />
					</div>

					{/* Rest of the wallet card content */}
					<div className="flex items-stretch gap-3 min-w-0 flex-1">
						{origin === "derived" && (
							<button
								type="button"
								className="btn btn-ghost btn-circle btn-xs text-base-content/60"
								aria-label="Hide wallet"
								onClick={() => onDelete(row)}
							>
								<i
									className="fa-solid fa-eye-slash h-4 w-4"
									aria-hidden="true"
								/>
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
										<i
											className="fa-solid fa-copy h-4 w-4"
											aria-hidden="true"
										/>
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
					<div className="flex sm:flex-col sm:justify-between sm:gap-0 flex-shrink-0">
						<Link
							href={`/receive/${row.address ?? ""}`}
							className="btn btn-primary flex items-center justify-center sm:flex-col sm:gap-1"
							style={{ width: "3.5rem", height: "3.5rem" }}
							aria-label="Receive funds"
						>
							<i
								className="fa-solid fa-qrcode"
								style={{ fontSize: "1.75rem" }}
								aria-hidden="true"
							/>
							<span className="text-xs hidden sm:inline leading-tight">
								Receive
							</span>
						</Link>
						{origin === "watchOnly" ? (
							<div
								className="tooltip tooltip-bottom"
								data-tip="Watch-only wallets cannot send transactions"
							>
								<button
									type="button"
									className="btn btn-secondary btn-disabled flex items-center justify-center sm:flex-col sm:gap-1"
									style={{ width: "3.5rem", height: "3.5rem" }}
									disabled
									aria-label="Send funds (watch-only wallet)"
								>
									<i
										className="fa-solid fa-paper-plane"
										style={{ fontSize: "1.75rem" }}
										aria-hidden="true"
									/>
									<span className="text-xs hidden sm:inline leading-tight">
										Send
									</span>
								</button>
							</div>
						) : (
							<Link
								href={`/send/${row.address ?? ""}`}
								className="btn btn-secondary flex items-center justify-center sm:flex-col sm:gap-1"
								style={{ width: "3.5rem", height: "3.5rem" }}
								aria-label="Send funds"
							>
								<i
									className="fa-solid fa-paper-plane"
									style={{ fontSize: "1.75rem" }}
									aria-hidden="true"
								/>
								<span className="text-xs hidden sm:inline leading-tight">
									Send
								</span>
							</Link>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
