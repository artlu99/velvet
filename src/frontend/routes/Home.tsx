import { Suspense, use } from "react";
import { WalletManagement } from "~/components/WalletManagement";
import { useEvolu } from "~/lib/evolu";

const HomeContent = () => {
	const evolu = useEvolu();

	// Ensure Evolu is initialized before queries (canonical pattern)
	use(evolu.appOwner);

	return (
		<div className="container mx-auto px-4 max-w-4xl space-y-4 sm:space-y-10">
			{/* Wallet Management Section */}
			<WalletManagement key="wallet-management" />
		</div>
	);
};

export const Home = () => {
	return (
		<Suspense
			fallback={
				<div className="container mx-auto px-4 py-8 max-w-4xl">
					<div className="loading loading-spinner mx-auto" />
				</div>
			}
		>
			<HomeContent />
		</Suspense>
	);
};
