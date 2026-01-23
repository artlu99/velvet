import { type FC, useEffect } from "react";
import {
	DEFAULT_COIN_IDS,
	usePricesQuery,
} from "~/hooks/queries/usePricesQuery";
import { useGlobalPortfolioTotal } from "~/hooks/useGlobalPortfolioTotal";
import { formatPriceAge, formatUsd } from "~/lib/helpers";
import { usePortfolioStore } from "~/providers/portfolioStore";

interface GlobalPortfolioTotalProps {
	readonly addresses: ReadonlyArray<string>;
}

/**
 * Displays the global portfolio total across all wallets.
 * Updates the portfolio store with the latest total.
 */
export const GlobalPortfolioTotal: FC<GlobalPortfolioTotalProps> = ({
	addresses,
}) => {
	const globalTotalUsd = useGlobalPortfolioTotal({ addresses });

	// Fetch prices for timestamp display
	const { data: pricesData } = usePricesQuery({
		coinIds: DEFAULT_COIN_IDS,
	});

	// Update portfolio store when total changes
	const setGlobalTotal = usePortfolioStore((state) => state.setGlobalTotal);

	useEffect(() => {
		if (globalTotalUsd !== null) {
			setGlobalTotal(globalTotalUsd);
		}
	}, [globalTotalUsd, setGlobalTotal]);

	if (addresses.length === 0) {
		return null;
	}

	return (
		<div className="card card-compact bg-primary/10 shadow-lg mb-6">
			<div className="card-body">
				<h3 className="text-sm font-semibold opacity-70">Portfolio Total</h3>
				{globalTotalUsd !== null ? (
					<>
						<div className="text-3xl font-bold tabular-nums">
							≈${formatUsd.format(globalTotalUsd)}
						</div>
						{pricesData?.ok && pricesData.timestamp && (
							<div className="text-xs opacity-60">
								Prices: {formatPriceAge(pricesData.timestamp)}
							</div>
						)}
					</>
				) : (
					<div className="flex items-center gap-2">
						<span className="loading loading-spinner loading-sm" />
						<span className="text-sm opacity-70">Loading prices...</span>
					</div>
				)}
			</div>
		</div>
	);
};
