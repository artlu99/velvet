import { useEvolu, useQuery } from "@evolu/react";
import { WalletManagement } from "~/components/WalletManagement";
import { createAllEoasQuery } from "~/lib/queries/eoa";

export const Landing = () => {
	const evolu = useEvolu();
	const allEoasQuery = createAllEoasQuery(evolu);
	const wallets = useQuery(allEoasQuery);

	const walletCount = wallets.length;
	const importedCount = wallets.filter((w) => w.origin === "imported").length;
	const watchOnlyCount = wallets.filter((w) => w.origin === "watchOnly").length;

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl space-y-12">
			{/* Wallet Management Section */}
			<WalletManagement />

			{/* Stats Overview Card */}
			<div className="card bg-base-200 max-w-lg mx-auto border border-base-300">
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

			{/* Hero Section */}
			<div className="text-center mt-8">
				<div className="mb-6">
					<div className="mb-4">
						<i className="fa-solid fa-bag-shopping text-6xl text-primary opacity-80" />
					</div>
					<p className="text-lg opacity-80 max-w-2xl mx-auto">
						Secure, local-first crypto wallet with private sync
					</p>
					<h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
						Underground Velvet
					</h1>
				</div>
			</div>

			{/* Image Section */}
			<div className="flex justify-center mt-12">
				<img
					src="/3e887299569d62da0a813ec6bac7e91d.jpg"
					alt="Underground Velvet Wallet"
					className="rounded-lg shadow-xl max-w-full h-auto"
				/>
			</div>
		</div>
	);
};
