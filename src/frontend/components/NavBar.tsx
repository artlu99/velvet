import { useEvolu, useQuery } from "@evolu/react";
import { Link } from "wouter";
import { useGlobalPortfolioTotal } from "~/hooks/useGlobalPortfolioTotal";
import { formatUsd } from "~/lib/helpers";
import { createAllEoasQuery } from "~/lib/queries/eoa";

export const NavBar = () => {
	const evolu = useEvolu();
	const allEoasQuery = createAllEoasQuery(evolu);
	const wallets = useQuery(allEoasQuery);

	// Exclude watch-only wallets from portfolio total
	const addresses = wallets
		.filter((w) => w.origin !== "watchOnly")
		.map((w) => w.address);
	const globalTotalUsd = useGlobalPortfolioTotal({ addresses });

	const renderPortfolioTotal = () => {
		if (addresses.length === 0) {
			return (
				<Link
					href="/"
					className="text-base-content/60 text-sm hover:text-base-content transition-colors"
				>
					No wallets yet
				</Link>
			);
		}

		if (globalTotalUsd === null) {
			return (
				<Link href="/">
					<div className="skeleton h-7 w-28 rounded" />
				</Link>
			);
		}

		return (
			<Link
				href="/"
				className="text-xl font-bold tabular-nums hover:text-primary transition-colors"
			>
				${formatUsd.format(globalTotalUsd)}
			</Link>
		);
	};

	return (
		<div className="navbar px-4">
			<div className="navbar-start">{renderPortfolioTotal()}</div>
			<div className="navbar-end">
				<div className="dropdown dropdown-end">
					<button
						type="button"
						className="btn btn-ghost btn-circle"
						aria-label="Menu"
					>
						<i className="fa-solid fa-bars text-lg" />
					</button>
					<ul className="dropdown-content menu bg-base-200 rounded-box shadow-lg z-50 w-52 p-2 mt-2">
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
						<li>
							<a
								href="https://github.com/artlu99/velvet/blob/main/SECURITY.md"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3"
							>
								<i className="fa-solid fa-building-shield" />
								Security
							</a>
						</li>
						<li>
							<a
								href="https://github.com/artlu99/velvet/blob/main/artifacts/MANIFESTO.md"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3"
							>
								<i className="fa-solid fa-explosion" />
								Manifesto
							</a>
						</li>
						<li>
							<a
								href="https://github.com/artlu99/velvet"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-3"
							>
								<i className="fa-brands fa-github" />
								GitHub
							</a>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
};
