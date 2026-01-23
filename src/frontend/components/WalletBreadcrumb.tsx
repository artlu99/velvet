import type { FC } from "react";

interface WalletBreadcrumbProps {
	readonly current: number; // 1-indexed
	readonly total: number;
}

/**
 * Breadcrumb indicator showing current wallet position.
 * Format: "Wallet m of n"
 * Shown on both mobile and desktop, replacing "Accounts" header
 */
export const WalletBreadcrumb: FC<WalletBreadcrumbProps> = ({
	current,
	total,
}) => {
	if (total === 0) return null;

	return (
		<div className="flex items-center justify-center py-1 sm:py-2 gap-2">
			<div className="join">
				<div className="join-item btn btn-sm btn-ghost font-normal">
					<i className="fa-solid fa-wallet mr-2" />
					Wallet {current} <span className="opacity-60 mx-1">of</span> {total}
				</div>
			</div>
		</div>
	);
};
