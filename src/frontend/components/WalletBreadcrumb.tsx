import type { FC } from "react";
import { pluralize } from "~/lib/helpers";

interface WalletBreadcrumbProps {
	readonly current: number; // 1-indexed
	readonly total: number;
}

/**
 * Breadcrumb indicator for wallet navigation.
 * Mobile: "{Wallet icon} m of n" (for carousel)
 * Desktop: "N wallets" heading
 */
export const WalletBreadcrumb: FC<WalletBreadcrumbProps> = ({
	current,
	total,
}) => {
	if (total === 0) return null;

	return (
		<div className="flex items-center justify-center py-1 sm:py-2 gap-2">
			{/* Mobile: Wallet m of n */}
			<div className="join sm:hidden">
				<div className="join-item btn btn-sm btn-ghost font-normal">
					<i className="fa-solid fa-wallet mr-2" />
					{current} <span className="opacity-60 mx-1">of</span> {total}
				</div>
			</div>
			{/* Desktop: N wallets */}
			<div className="hidden sm:flex items-center gap-2">
				<i className="fa-solid fa-wallet text-primary" />
				<span className="font-semibold">{pluralize(total, "wallet")}</span>
			</div>
		</div>
	);
};
