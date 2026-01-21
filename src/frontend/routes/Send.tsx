import { useEvolu, useQuery } from "@evolu/react";
import invariant from "tiny-invariant";
import { Link, useParams } from "wouter";
import { SendForm } from "~/components/SendForm";
import { useBalanceQuery } from "~/hooks/queries/useBalanceQuery";
import { createAllEoasQuery } from "~/lib/queries/eoa";
import { useReceiveStore } from "~/providers/store";

export const Send = () => {
	const evolu = useEvolu();
	const { address } = useParams<{ address?: string }>();
	const { network } = useReceiveStore();

	// Get all wallets
	const allEoasQuery = createAllEoasQuery(evolu);
	const allWallets = useQuery(allEoasQuery);

	// Determine which wallet to use
	const selectedWallet = address
		? allWallets.find((w) => w.address.toLowerCase() === address.toLowerCase())
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

	const balance =
		balanceData?.ok && balanceData.balanceWei ? balanceData.balanceWei : "0";
	const encryptedPrivateKey = selectedWallet.encryptedPrivateKey;
	const isWatchOnly = selectedWallet.origin === "watchOnly";

	// For non-watch-only wallets, encryptedPrivateKey must exist
	if (!isWatchOnly) {
		invariant(
			encryptedPrivateKey,
			"encryptedPrivateKey must exist for non-watch-only wallets",
		);
	}

	return (
		<div className="max-w-md mx-auto p-4">
			{isWatchOnly ? (
				<div className="alert alert-info">
					<i className="fa-solid fa-eye shrink-0 text-2xl" aria-hidden="true" />
					<div>
						<h3 className="font-bold text-lg">Watch-Only Wallet</h3>
						<div className="text-sm mt-2">
							This wallet can <strong>monitor balances</strong> and{" "}
							<strong>receive funds</strong>, but cannot send transactions
							because the private key is not stored.
						</div>
						<div className="text-sm mt-2">
							To send transactions, import the wallet with its private key.
						</div>
						<div className="mt-4">
							<div className="stat bg-base-200 rounded-lg">
								<div className="stat-title font-mono text-sm">
									{selectedWallet.address.slice(0, 6)}
									...
									{selectedWallet.address.slice(-4)}
								</div>
								<div className="stat-desc">Balance: {balance} wei</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				encryptedPrivateKey && (
					<SendForm
						address={selectedWallet.address}
						balance={balance}
						encryptedPrivateKey={encryptedPrivateKey}
					/>
				)
			)}
		</div>
	);
};
