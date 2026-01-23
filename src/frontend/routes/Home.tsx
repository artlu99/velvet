import { useEvolu, useQuery } from "@evolu/react";
import { WalletManagement } from "~/components/WalletManagement";
import { createAllEoasQuery } from "~/lib/queries/eoa";

export const Home = () => {
	const evolu = useEvolu();
	const allEoasQuery = createAllEoasQuery(evolu);
	const wallets = useQuery(allEoasQuery);

	const walletCount = wallets.length;
	const importedCount = wallets.filter((w) => w.origin === "imported").length;
	const watchOnlyCount = wallets.filter((w) => w.origin === "watchOnly").length;
	const derivedCount = wallets.filter((w) => w.origin === "derived").length;

	return (
		<div className="container mx-auto px-4 max-w-4xl">
			{/* Wallet Management Section */}
			<WalletManagement />

			{/* Stats Overview Card - desktop only */}
			<div className="hidden sm:block card bg-base-200 max-w-lg mx-auto border border-base-300">
				<div className="card-body p-4">
					<div className="stats stats-horizontal w-full compact">
						<div className="stat py-2 px-4">
							<div className="stat-title text-xs">Total</div>
							<div className="flex items-center gap-2">
								<i className="fa-solid fa-wallet text-xl text-primary" />
								<div className="stat-value text-2xl text-primary">
									{walletCount}
								</div>
							</div>
						</div>

						<div className="stat py-2 px-4">
							<div className="stat-title text-xs">Derived</div>
							<div className="flex items-center gap-2">
								<i className="fa-solid fa-key text-xl text-accent" />
								<div className="stat-value text-2xl text-accent">
									{derivedCount}
								</div>
							</div>
						</div>

						<div className="stat py-2 px-4">
							<div className="stat-title text-xs">Imported</div>
							<div className="flex items-center gap-2">
								<i className="fa-solid fa-download text-xl text-secondary" />
								<div className="stat-value text-2xl text-secondary">
									{importedCount}
								</div>
							</div>
						</div>

						<div className="stat py-2 px-4">
							<div className="stat-title text-xs">Watch Only</div>
							<div className="flex items-center gap-2">
								<i className="fa-solid fa-eye text-xl text-info" />
								<div className="stat-value text-2xl text-info">
									{watchOnlyCount}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
