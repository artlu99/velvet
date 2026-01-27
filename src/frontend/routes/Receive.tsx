import { useQuery } from "@evolu/react";
import type { KeyType } from "@shared/types";
import type React from "react";
import { Suspense, use, useState } from "react";
import invariant from "tiny-invariant";
import { Link, useParams } from "wouter";
import { QRCodeDisplay } from "~/components/QRCodeDisplay";
import { useEvolu } from "~/lib/evolu";
import { allEoasQuery, normalizeAddressForQuery } from "~/lib/queries/eoa";

const ReceiveContent = () => {
	const { address } = useParams<{ address?: string }>();
	const evolu = useEvolu();

	// Ensure Evolu is initialized before queries (canonical pattern)
	use(evolu.appOwner);

	// Local state for EVM network selection (only used for EVM wallets)
	const [evmNetwork, setEvmNetwork] = useState<"ethereum" | "base">("base");

	// Canonical Evolu pattern: useQuery with module-level query
	const allWallets = useQuery(allEoasQuery);

	// Determine which wallet to display
	// Priority: 1) address from URL  2) selected wallet  3) first wallet
	let selectedWallet = address
		? allWallets.find(
				(w) =>
					w.address &&
					normalizeAddressForQuery(w.address) ===
						normalizeAddressForQuery(address),
			)
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

	// Get the wallet's keyType and derive the appropriate network
	const walletKeyType: KeyType = selectedWallet.keyType ?? "evm";

	// Derive network from wallet type - no global state, no useEffect needed
	// Tron wallets always use "tron", EVM wallets use local state
	const isEvmWallet = walletKeyType === "evm";
	const isTronWallet = walletKeyType === "tron";
	const network = isTronWallet ? "tron" : evmNetwork;

	return (
		<div className="max-w-md mx-auto p-4 mb-12">
			<h1 className="text-2xl font-bold mb-6">Receive Crypto</h1>

			{/* Network Selection */}
			<div className="mb-6">
				<div className="label">
					<span className="label-text">Network</span>
				</div>
				<div role="tablist" className="tabs tabs-boxed w-full">
					{isEvmWallet && (
						<>
							<button
								type="button"
								role="tab"
								className={`tab ${network === "ethereum" ? "tab-active" : ""}`}
								onClick={() => setEvmNetwork("ethereum")}
							>
								Ethereum
							</button>
							<button
								type="button"
								role="tab"
								className={`tab ${network === "base" ? "tab-active" : ""}`}
								onClick={() => setEvmNetwork("base")}
							>
								Base
							</button>
						</>
					)}
					{isTronWallet && (
						<button
							type="button"
							role="tab"
							className="tab tab-active"
							disabled
						>
							Tron
						</button>
					)}
				</div>
			</div>

			{/* QR Code Display */}
			<div className="card card-compact bg-base-200 shadow-xl mb-6">
				<div className="card-body">
					<h2 className="card-title">Scan to Receive</h2>
					<QRCodeDisplay address={selectedWallet.address} network={network} />
				</div>
			</div>

			{/* Wallet Selection */}
			{allWallets.length > 1 && (
				<div>
					<div className="label">
						<span className="label-text">Select Wallet</span>
					</div>
					<button
						type="button"
						className="btn btn-bordered w-full justify-between"
						role="combobox"
						aria-expanded="false"
						aria-controls="wallet-dropdown"
						popoverTarget="wallet-dropdown"
						style={
							{ anchorName: "--wallet-dropdown-anchor" } as React.CSSProperties
						}
					>
						<span className="font-mono text-sm">
							{selectedWallet.address
								? `${selectedWallet.address.slice(0, 6)}...${selectedWallet.address.slice(-4)}`
								: ""}
						</span>
						<i className="fa-solid fa-chevron-up text-xs" aria-hidden="true" />
					</button>
					<ul
						id="wallet-dropdown"
						className="dropdown menu p-2 bg-neutral text-neutral-content rounded-sm w-full"
						popover="auto"
						style={
							{
								positionAnchor: "--wallet-dropdown-anchor",
							} as React.CSSProperties
						}
					>
						{allWallets
							.filter((wallet) => wallet.address)
							.map((wallet) => (
								<li key={wallet.id}>
									<Link
										href={`/receive/${wallet.address ?? ""}`}
										className="font-mono text-sm"
									>
										{wallet.address
											? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
											: ""}
									</Link>
								</li>
							))}
					</ul>
				</div>
			)}
		</div>
	);
};

export const Receive = () => {
	return (
		<Suspense
			fallback={
				<div className="max-w-md mx-auto p-4">
					<div className="loading loading-spinner mx-auto" />
				</div>
			}
		>
			<ReceiveContent />
		</Suspense>
	);
};
