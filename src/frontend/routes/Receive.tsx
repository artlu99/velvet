import { useEvolu, useQuery } from "@evolu/react";
import invariant from "tiny-invariant";
import { Link, useParams } from "wouter";
import { QRCodeDisplay } from "~/components/QRCodeDisplay";
import { createAllEoasQuery } from "~/lib/queries/eoa";
import { useReceiveStore } from "~/providers/store";

export const Receive = () => {
	const evolu = useEvolu();
	const { address } = useParams<{ address?: string }>();
	const { network, setNetwork } = useReceiveStore();

	// Get all wallets for selection dropdown
	const allEoasQuery = createAllEoasQuery(evolu);
	const allWallets = useQuery(allEoasQuery);

	// Determine which wallet to display
	// Priority: 1) address from URL  2) selected wallet  3) first wallet
	let selectedWallet = address
		? allWallets.find((w) => w.address.toLowerCase() === address.toLowerCase())
		: null;

	if (!selectedWallet) {
		// Fall back to currently selected wallet
		const selectedWallets = allWallets.filter((w) => w.isSelected === 1);
		selectedWallet = selectedWallets[0];
	}
	if (!selectedWallet && allWallets.length > 0) {
		// Fall back to first wallet
		selectedWallet = allWallets[0];
	}

	if (!selectedWallet) {
		return (
			<div className="max-w-md mx-auto p-4">
				<div className="text-center py-12">
					<h2 className="text-xl font-bold mb-4">No Wallet Found</h2>
					<p className="text-sm opacity-70 mb-4">
						Import a wallet first to receive funds.
					</p>
					<Link href="/" className="btn btn-primary">
						Go to Wallets
					</Link>
				</div>
			</div>
		);
	}

	invariant(selectedWallet.address, "Wallet address is required");

	return (
		<div className="max-w-md mx-auto p-4">
			<div className="mb-6">
				<Link href="/" className="btn btn-ghost btn-sm">
					<i className="fa-solid fa-arrow-left mr-2" aria-hidden="true" />
					Back to Wallets
				</Link>
			</div>

			<h1 className="text-2xl font-bold mb-6">Receive Crypto</h1>

			{/* Wallet Selection */}
			{allWallets.length > 1 && (
				<div className="mb-6">
					<div className="label">
						<span className="label-text">Select Wallet</span>
					</div>
					<div className="dropdown dropdown-bottom w-full">
						<button
							type="button"
							className="btn btn-bordered w-full justify-between"
							tabIndex={0}
							role="combobox"
							aria-expanded="false"
							aria-controls="wallet-dropdown"
						>
							<span className="font-mono text-sm">
								{selectedWallet.address.slice(0, 6)}...
								{selectedWallet.address.slice(-4)}
							</span>
							<i
								className="fa-solid fa-chevron-down text-xs"
								aria-hidden="true"
							/>
						</button>
						<ul
							id="wallet-dropdown"
							className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full"
						>
							{allWallets.map((wallet) => (
								<li key={wallet.id}>
									<Link
										href={`/receive/${wallet.address}`}
										className="font-mono text-sm"
									>
										{wallet.address.slice(0, 6)}...
										{wallet.address.slice(-4)}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{/* Network Selection */}
			<div className="mb-6">
				<div className="label">
					<span className="label-text">Network</span>
				</div>
				<div role="tablist" className="tabs tabs-boxed w-full">
					<button
						type="button"
						role="tab"
						className={`tab ${network === "ethereum" ? "tab-active" : ""}`}
						onClick={() => setNetwork("ethereum")}
					>
						Ethereum
					</button>
					<button
						type="button"
						role="tab"
						className={`tab ${network === "base" ? "tab-active" : ""}`}
						onClick={() => setNetwork("base")}
					>
						Base
					</button>
				</div>
			</div>

			{/* QR Code Display */}
			<div className="card card-compact bg-base-200 shadow-xl">
				<div className="card-body">
					<h2 className="card-title">Scan to Receive</h2>
					<QRCodeDisplay address={selectedWallet.address} network={network} />
				</div>
			</div>
		</div>
	);
};
