import type { FC } from "react";
import { useMemo } from "react";
import { usePersistedPricesQuery } from "~/hooks/queries/usePersistedPricesQuery";
import { DEFAULT_COIN_IDS } from "~/hooks/queries/usePricesQuery";
import { useGlobalPortfolioTotal } from "~/hooks/useGlobalPortfolioTotal";
import { formatPriceAge, formatUsd } from "~/lib/helpers";

interface GlobalPortfolioTotalProps {
	readonly addresses: ReadonlyArray<string>;
}

/**
 * Displays the global portfolio total across all wallets.
 */
export const GlobalPortfolioTotal: FC<GlobalPortfolioTotalProps> = ({
	addresses,
}) => {
	// Memoize addresses array to prevent infinite renders
	// Filter out null/empty addresses and only recreate if addresses actually change
	// The addresses prop is already memoized in Home.tsx, so this should be stable
	const stableAddresses = useMemo(() => {
		return addresses.filter(
			(addr): addr is string => addr !== null && addr !== "",
		);
	}, [addresses]);

	// Calculate global portfolio total using the hook
	const globalTotalUsd = useGlobalPortfolioTotal({
		addresses: stableAddresses,
	});

	// Fetch prices for timestamp display (with cache check)
	const { data: pricesData, cached: cachedPrices } = usePersistedPricesQuery({
		coinIds: DEFAULT_COIN_IDS,
	});

	if (stableAddresses.length === 0) {
		return null;
	}

	// Show spinner only on first load when there's no cached data at all
	// Otherwise show the total (even if 0) using stale/cached data
	const hasCachedData = cachedPrices !== null;
	const hasAnyData = globalTotalUsd !== null || pricesData?.ok || hasCachedData;
	const showSpinner = !hasAnyData;

	return (
		<div className="card card-compact bg-primary/10 shadow-lg mb-6">
			<div className="card-body">
				<h3 className="text-sm font-semibold opacity-70">Portfolio Total</h3>
				<div className="text-3xl font-bold tabular-nums">
					{showSpinner ? (
						<span className="loading loading-spinner loading-sm" />
					) : (
						<>≈${formatUsd.format(globalTotalUsd ?? 0)}</>
					)}
				</div>
				{(pricesData?.ok || cachedPrices) && (
					<div className="text-xs opacity-60">
						Prices:{" "}
						{pricesData?.ok && pricesData.timestamp
							? formatPriceAge(pricesData.timestamp)
							: cachedPrices?.updatedAt
								? formatPriceAge(new Date(cachedPrices.updatedAt).getTime())
								: null}
					</div>
				)}
			</div>
		</div>
	);
};
