import { use, useEffect } from "react";
import { WalletManagement } from "~/components/WalletManagement";
import { seedAppBlocklist } from "~/lib/constants/blocklistAddresses";
import { useEvolu } from "~/lib/evolu";

export const Home = () => {
	const evolu = useEvolu();

	// Ensure Evolu is initialized before queries (canonical pattern)
	use(evolu.appOwner);

	// Seed app-provided blocklist on initialization
	useEffect(() => {
		seedAppBlocklist(evolu);
	}, [evolu]);

	return (
		<div className="container mx-auto px-4 max-w-4xl space-y-4 sm:space-y-10">
			{/* Wallet Management Section */}
			<WalletManagement key="wallet-management" />
		</div>
	);
};
