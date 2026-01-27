import type { FC } from "react";
import type { EoaRow } from "~/lib/eoaValidation";

interface WalletStatsProps {
	readonly wallets: readonly EoaRow[];
}

/**
 * Displays wallet statistics (counts by type) on desktop only.
 * Hidden on mobile to save space.
 */
export const WalletStats: FC<WalletStatsProps> = ({ wallets }) => {
	// Count wallets by type
	const stats = wallets.reduce(
		(acc, wallet) => {
			if (wallet.origin === "imported") acc.imported++;
			else if (wallet.origin === "derived") acc.derived++;
			else if (wallet.origin === "watchOnly") acc.watchOnly++;

			if (wallet.keyType === "evm") acc.evm++;
			else if (wallet.keyType === "tron") acc.tron++;

			return acc;
		},
		{ imported: 0, derived: 0, watchOnly: 0, evm: 0, tron: 0 },
	);

	const total = wallets.length;

	if (total === 0) {
		return null;
	}

	return (
		<div className="stats stats-horizontal shadow bg-base-200">
			<div className="stat">
				<div className="stat-title">Total</div>
				<div className="stat-value text-2xl text-secondary flex items-center gap-2">
					{total}
					<i className="fa-solid fa-wallet text-lg" />
				</div>
			</div>
			<div className="stat">
				<div className="stat-title">Derived</div>
				<div className="stat-value text-2xl text-accent flex items-center gap-2">
					{stats.derived}
					<i className="fa-solid fa-key text-lg" />
				</div>
			</div>
			<div className="stat">
				<div className="stat-title">Imported</div>
				<div className="stat-value text-2xl text-primary flex items-center gap-2">
					{stats.imported}
					<i className="fa-solid fa-download text-lg" />
				</div>
			</div>
			<div className="stat">
				<div className="stat-title">Watch-Only</div>
				<div className="stat-value text-2xl text-info flex items-center gap-2">
					{stats.watchOnly}
					<i className="fa-solid fa-eye text-lg" />
				</div>
			</div>
		</div>
	);
};
