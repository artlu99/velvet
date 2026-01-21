import { sqliteTrue } from "@evolu/common";
import { useEvolu, useQuery } from "@evolu/react";
import { type FC, useState } from "react";
import type { EoaId } from "~/lib/schema";
import { DeleteKeyConfirmation } from "./DeleteKeyConfirmation";

export const WalletList: FC = () => {
	const evolu = useEvolu();
	const [deleteTarget, setDeleteTarget] = useState<{
		id: EoaId;
		address: string;
	} | null>(null);

	// Query all non-deleted EOAs
	const allEoas = evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("isDeleted", "is", null)
			.orderBy("createdAt", "desc"),
	);

	const rows = useQuery(allEoas);

	const handleDelete = () => {
		if (!deleteTarget) return;

		evolu.update("eoa", {
			id: deleteTarget.id,
			isDeleted: sqliteTrue,
		});

		setDeleteTarget(null);
	};

	return (
		<>
			<div className="space-y-3">
				{rows.map((row) => (
					<div key={row.id} className="card card-compact bg-base-200 shadow">
						<div className="card-body">
							<div className="flex items-center justify-between">
								<div>
									<div className="flex items-center gap-2">
										<h3 className="font-mono text-sm">
											{row.address.slice(0, 6)}...{row.address.slice(-4)}
										</h3>
										{/** biome-ignore lint/a11y/useAnchorContent: aria label is used */}
										<a
											href={`https://etherscan.io/address/${row.address}`}
											target="_blank"
											rel="noopener noreferrer"
											className="btn btn-ghost btn-xs btn-circle"
											aria-label="View on Etherscan"
										>
											<i
												className="fa-solid fa-external-link h-4 w-4"
												aria-hidden="true"
											/>
										</a>
									</div>
									<div className="mt-1 flex gap-1">
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

								<div className="flex gap-2">
									{row.origin === "imported" && (
										<button
											type="button"
											className="btn btn-error btn-sm"
											onClick={() =>
												setDeleteTarget({ id: row.id, address: row.address })
											}
										>
											<i
												className="fa-solid fa-trash h-4 w-4"
												aria-hidden="true"
											/>
										</button>
									)}
								</div>
							</div>
						</div>
					</div>
				))}

				{rows.length === 0 && (
					<div className="text-center text-gray-500 py-8">
						No keys yet. Import one or generate from mnemonic.
					</div>
				)}
			</div>

			{deleteTarget && (
				<DeleteKeyConfirmation
					address={deleteTarget.address}
					onConfirm={handleDelete}
					onCancel={() => setDeleteTarget(null)}
				/>
			)}
		</>
	);
};
