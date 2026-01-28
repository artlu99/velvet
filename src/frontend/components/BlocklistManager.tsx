/**
 * Blocklist Management Component
 *
 * Displays and manages user's address blocklist
 */

import { useQuery } from "@evolu/react";
import { type FC, use, useState } from "react";
import toast from "react-hot-toast";
import { isAddress } from "viem";
import { EnsOrAddress } from "~/components/EnsOrAddress";
import { useEvolu } from "~/lib/evolu";
import {
	addToBlocklist,
	createActiveBlocklistQuery,
	removeFromBlocklist,
} from "~/lib/queries/blocklist";
import type { BlocklistId } from "~/lib/schema";

export const BlocklistManager: FC = () => {
	const evolu = useEvolu();

	// Ensure Evolu is initialized before queries (canonical pattern)
	use(evolu.appOwner);

	// Query for active blocklist entries
	const blocklistQuery = createActiveBlocklistQuery(evolu);
	const blocklistEntries = useQuery(blocklistQuery);

	// Add address form state
	const [showAddModal, setShowAddModal] = useState(false);
	const [newAddress, setNewAddress] = useState("");
	const [newReason, setNewReason] = useState("");
	const [isAdding, setIsAdding] = useState(false);

	// Filter state
	const [filterSource, setFilterSource] = useState<"all" | "app" | "user">(
		"all",
	);

	// Filter blocklist entries by source
	const filteredEntries = blocklistEntries.filter((entry) => {
		if (filterSource === "all") return true;
		return entry.source === filterSource;
	});

	// Handle add address
	const handleAddAddress = async () => {
		if (!newAddress || !isAddress(newAddress)) {
			toast.error("Invalid Ethereum address");
			return;
		}

		setIsAdding(true);
		try {
			await addToBlocklist(evolu, newAddress, newReason || undefined);
			toast.success("Address added to blocklist");
			setNewAddress("");
			setNewReason("");
			setShowAddModal(false);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			toast.error(`Failed to add address: ${errorMessage}`);
		} finally {
			setIsAdding(false);
		}
	};

	// Handle remove address
	const handleRemoveAddress = async (id: BlocklistId) => {
		try {
			await removeFromBlocklist(evolu, id);
			toast.success("Address removed from blocklist");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			toast.error(`Failed to remove address: ${errorMessage}`);
		}
	};

	return (
		<div className="max-w-4xl mx-auto p-4">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold">Blocklist</h1>
				<button
					type="button"
					className="btn btn-primary"
					onClick={() => setShowAddModal(true)}
				>
					<i className="fa-solid fa-plus" />
					Add Address
				</button>
			</div>

			{/* Filter Tabs */}
			<div className="tabs tabs-boxed mb-4">
				<button
					type="button"
					className={`tab ${filterSource === "all" ? "tab-active" : ""}`}
					onClick={() => setFilterSource("all")}
				>
					All ({blocklistEntries.length})
				</button>
				<button
					type="button"
					className={`tab ${filterSource === "app" ? "tab-active" : ""}`}
					onClick={() => setFilterSource("app")}
				>
					App ({blocklistEntries.filter((e) => e.source === "app").length})
				</button>
				<button
					type="button"
					className={`tab ${filterSource === "user" ? "tab-active" : ""}`}
					onClick={() => setFilterSource("user")}
				>
					User ({blocklistEntries.filter((e) => e.source === "user").length})
				</button>
			</div>

			{/* Blocklist Entries */}
			{filteredEntries.length === 0 ? (
				<div className="card bg-base-200">
					<div className="card-body text-center py-12">
						<i
							className="fa-solid fa-shield-halved text-4xl opacity-50 mb-4"
							aria-hidden="true"
						/>
						<p className="text-lg opacity-70">
							{filterSource === "all"
								? "No addresses in blocklist"
								: `No ${filterSource} addresses in blocklist`}
						</p>
					</div>
				</div>
			) : (
				<div className="space-y-2">
					{filteredEntries.map((entry) => (
						<div key={entry.id} className="card bg-base-200 card-compact">
							<div className="card-body p-4">
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-2">
											<EnsOrAddress address={entry.address} />
											<span
												className={`badge badge-sm ${
													entry.source === "app"
														? "badge-info"
														: "badge-secondary"
												}`}
											>
												{entry.source === "app" ? "App" : "User"}
											</span>
										</div>
										{entry.reason && (
											<p className="text-sm opacity-70">{entry.reason}</p>
										)}
										{entry.addedAt && (
											<p className="text-xs opacity-50 mt-1">
												Added: {new Date(entry.addedAt).toLocaleDateString()}
											</p>
										)}
									</div>
									{entry.source === "user" && (
										<button
											type="button"
											className="btn btn-ghost btn-sm btn-square"
											onClick={() => handleRemoveAddress(entry.id)}
											aria-label="Remove from blocklist"
										>
											<i className="fa-solid fa-trash" aria-hidden="true" />
										</button>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Add Address Modal */}
			{showAddModal && (
				<dialog className="modal modal-open">
					<div className="modal-box">
						<h3 className="font-bold text-lg mb-4">Add Address to Blocklist</h3>
						<div className="form-control mb-4">
							<label className="label" htmlFor="blocklist-address">
								<span className="label-text">Address</span>
							</label>
							<input
								id="blocklist-address"
								type="text"
								className="input input-bordered font-mono"
								placeholder="0x..."
								value={newAddress}
								onChange={(e) => setNewAddress(e.target.value)}
								autoComplete="off"
							/>
						</div>
						<div className="form-control mb-4">
							<label className="label" htmlFor="blocklist-reason">
								<span className="label-text">Reason (Optional)</span>
							</label>
							<input
								id="blocklist-reason"
								type="text"
								className="input input-bordered"
								placeholder="e.g., Suspicious activity"
								value={newReason}
								onChange={(e) => setNewReason(e.target.value)}
								autoComplete="off"
							/>
						</div>
						<div className="modal-action">
							<button
								type="button"
								className="btn btn-ghost"
								onClick={() => {
									setShowAddModal(false);
									setNewAddress("");
									setNewReason("");
								}}
							>
								Cancel
							</button>
							<button
								type="button"
								className="btn btn-primary"
								onClick={handleAddAddress}
								disabled={isAdding || !newAddress || !isAddress(newAddress)}
							>
								{isAdding ? (
									<span className="loading loading-spinner" />
								) : (
									"Add"
								)}
							</button>
						</div>
					</div>
					<form method="dialog" className="modal-backdrop">
						<button
							type="button"
							onClick={() => {
								setShowAddModal(false);
								setNewAddress("");
								setNewReason("");
							}}
						>
							Close
						</button>
					</form>
				</dialog>
			)}
		</div>
	);
};
