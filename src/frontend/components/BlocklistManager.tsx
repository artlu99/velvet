/**
 * Blocklist Management Component
 *
 * Displays user's address blocklist
 */

import type { FC } from "react";
import { EnsOrAddress } from "~/components/EnsOrAddress";
import { BLOCKLIST } from "~/lib/queries/blocklist";

export const BlocklistManager: FC = () => {
	const blocklist = BLOCKLIST;

	return (
		<div className="max-w-4xl mx-auto p-4">
			{/* Blocklist Entries */}
			{blocklist.length === 0 ? (
				<div className="card bg-base-200">
					<div className="card-body text-center py-12">
						<i
							className="fa-solid fa-shield-halved text-4xl opacity-50 mb-4"
							aria-hidden="true"
						/>
						<p className="text-lg opacity-70">No addresses in blocklist</p>
					</div>
				</div>
			) : (
				<div className="space-y-2">
					{blocklist.map((entry) => (
						<div key={entry.address} className="card bg-base-200 card-compact">
							<div className="card-body p-4">
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-2">
											<EnsOrAddress address={entry.address} />
										</div>
										{entry.reason && (
											<p className="text-sm opacity-70">{entry.reason}</p>
										)}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};
