import { useEvolu, useQuery } from "@evolu/react";
import invariant from "tiny-invariant";
import { Link, useParams } from "wouter";
import { SendForm } from "~/components/SendForm";
import { useBalanceQuery } from "~/hooks/queries/useBalanceQuery";
import { createAllEoasQuery } from "~/lib/queries/eoa";
import { useReceiveStore } from "~/providers/store";

export const Send = () => {
	const evolu = useEvolu();
	const { walletId } = useParams<{ walletId?: string }>();
	const { network } = useReceiveStore();

	// Get all wallets
	const allEoasQuery = createAllEoasQuery(evolu);
	const allWallets = useQuery(allEoasQuery);

	// Determine which wallet to use
	const selectedWallet = walletId
		? allWallets.find((w) => w.id === walletId)
		: (allWallets.find((w) => w.isSelected === 1) ?? allWallets[0]);

	const chainId = network === "ethereum" ? 1 : 8453;
	const { data: balanceData } = useBalanceQuery({
		address: selectedWallet?.address ?? "",
		chainId,
		enabled: !!selectedWallet?.address,
	});

	if (!selectedWallet) {
		return (
			<div className="max-w-md mx-auto p-4">
				<div className="text-center py-12">
					<h2 className="text-xl font-bold mb-4">No Wallet Found</h2>
					<p className="text-sm opacity-70 mb-4">
						Import a wallet first to send funds.
					</p>
					<Link href="/" className="btn btn-primary">
						Go to Wallets
					</Link>
				</div>
			</div>
		);
	}

	invariant(selectedWallet.address, "Wallet address is required");
	invariant(selectedWallet.unencryptedPrivateKey, "Private key is required");

	const balance =
		balanceData?.ok && balanceData.balanceWei ? balanceData.balanceWei : "0";

	return (
		<SendForm
			walletId={selectedWallet.id}
			address={selectedWallet.address}
			balance={balance}
			privateKey={selectedWallet.unencryptedPrivateKey}
		/>
	);
};
