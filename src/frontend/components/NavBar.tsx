import { useQuery } from "@evolu/react";
import { Suspense, useMemo, useState } from "react";
import { Link } from "wouter";
import { usePersistedPricesQuery } from "~/hooks/queries/usePersistedPricesQuery";
import { DEFAULT_COIN_IDS } from "~/hooks/queries/usePricesQuery";
import { useGlobalPortfolioTotal } from "~/hooks/useGlobalPortfolioTotal";
import { documentationLinks } from "~/lib/documentation-links";
import { formatPriceAge, formatUsd } from "~/lib/helpers";
import { allEoasQuery } from "~/lib/queries/eoa";

const NavBarContent = () => {
	// Canonical Evolu pattern: useQuery with module-level query
	const wallets = useQuery(allEoasQuery);

	// Toggle for including WatchOnly wallets in portfolio total
	const [includeWatchOnly, setIncludeWatchOnly] = useState(true);

	// Identify WatchOnly wallets and extract addresses
	const { watchOnlyWallets, filteredAddresses } = useMemo(() => {
		const watchOnly: string[] = [];
		const result: string[] = [];

		for (const wallet of wallets) {
			const addr = wallet.address;
			if (addr && typeof addr === "string") {
				const address = String(addr);
				if (wallet.origin === "watchOnly") {
					watchOnly.push(address);
				}
				// Include address if: not watch-only OR (watch-only and toggle is on)
				if (wallet.origin !== "watchOnly" || includeWatchOnly) {
					result.push(address);
				}
			}
		}

		return { watchOnlyWallets: watchOnly, filteredAddresses: result };
	}, [wallets, includeWatchOnly]);

	// global portfolio total
	const globalTotalUsd = useGlobalPortfolioTotal({
		addresses: filteredAddresses,
	});

	// Fetch prices for timestamp display
	const { data: pricesData, cached: cachedPrices } = usePersistedPricesQuery({
		coinIds: DEFAULT_COIN_IDS,
	});

	const renderPortfolioTotal = () => {
		if (wallets.length === 0) {
			return (
				<Link
					href="/"
					className="text-base-content/60 text-sm hover:text-base-content transition-colors"
				>
					No wallets yet
				</Link>
			);
		}

		const isLoading = globalTotalUsd === null;
		const hasPriceTimestamp =
			(pricesData?.ok && pricesData.timestamp) || cachedPrices?.updatedAt;
		const hasWatchOnlyWallets = watchOnlyWallets.length > 0;

		return (
			<div className="flex items-center gap-2">
				{hasWatchOnlyWallets && (
					<button
						type="button"
						onClick={() => setIncludeWatchOnly(!includeWatchOnly)}
						className="btn btn-ghost btn-circle btn-sm"
						aria-label={
							includeWatchOnly
								? "Exclude WatchOnly wallets"
								: "Include WatchOnly wallets"
						}
						title={
							includeWatchOnly
								? "Exclude WatchOnly wallets"
								: "Include WatchOnly wallets"
						}
					>
						<i
							className={`fa-solid fa-eye${includeWatchOnly ? "" : "-slash"} text-base-content/80`}
						/>
					</button>
				)}
				<Link href="/" className="hover:text-primary transition-colors">
					{isLoading ? (
						<div className="text-xl font-bold tabular-nums">
							<span className="loading loading-spinner loading-sm" />
						</div>
					) : (
						<div className="flex flex-col">
							<span className="text-xl font-bold tabular-nums">
								${formatUsd.format(globalTotalUsd)}
							</span>
							{hasPriceTimestamp && (
								<span className="text-xs opacity-60">
									{pricesData?.ok && pricesData.timestamp
										? formatPriceAge(pricesData.timestamp)
										: cachedPrices?.updatedAt
											? formatPriceAge(
													new Date(cachedPrices.updatedAt).getTime(),
												)
											: null}
								</span>
							)}
						</div>
					)}
				</Link>
			</div>
		);
	};

	return (
		<div className="navbar px-4 pt-[env(safe-area-inset-top)]">
			<div className="navbar-start">{renderPortfolioTotal()}</div>
			<div className="navbar-end flex items-center gap-2">
				<button
					type="button"
					className="btn btn-ghost btn-circle"
					aria-label="Menu"
					popoverTarget="navbar-menu"
					style={{ anchorName: "--navbar-menu-anchor" } as React.CSSProperties}
				>
					<i className="fa-solid fa-bars text-lg" />
				</button>
				<ul className="menu menu-vertical gap-1">
					<ul
						className="dropdown menu bg-neutral text-neutral-content rounded-sm w-52 p-2"
						popover="auto"
						id="navbar-menu"
						style={
							{
								positionAnchor: "--navbar-menu-anchor",
								positionArea: "bottom span-left",
							} as React.CSSProperties
						}
					>
						<li>
							<Link href="/" className="flex items-center gap-3">
								<i className="fa-solid fa-wallet" />
								Wallet
							</Link>
						</li>
						<li>
							<Link href="/account" className="flex items-center gap-3">
								<i className="fa-solid fa-cloud-bolt" />
								Data
							</Link>
						</li>
						<div className="divider my-1" />
						{documentationLinks.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-3"
								>
									<i className={link.icon} />
									{link.label}
								</a>
							</li>
						))}
						<li>
							<Link
								href="/landing"
								className="flex items-center gap-3"
								style={{ color: "#D362B4" }}
							>
								<i className="fa-solid fa-bag-shopping" />
								Velvet
							</Link>
						</li>
					</ul>
				</ul>
			</div>
		</div>
	);
};

export const NavBar = () => {
	return (
		<Suspense
			fallback={
				<div className="navbar px-4 pt-[env(safe-area-inset-top)]">
					<div className="loading loading-spinner" />
				</div>
			}
		>
			<NavBarContent />
		</Suspense>
	);
};
