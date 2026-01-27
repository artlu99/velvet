import { useQuery } from "@evolu/react";
import type { KeyType, SupportedChainId } from "@shared/types";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import invariant from "tiny-invariant";
import { Link, useParams } from "wouter";
import { SendForm } from "~/components/SendForm";
import { TokenSelector } from "~/components/TokenSelector";
import { useBalanceQuery } from "~/hooks/queries/useBalanceQuery";
import { useErc20BalanceQuery } from "~/hooks/queries/useErc20BalanceQuery";
import { useTrc20BalanceQuery } from "~/hooks/queries/useTrc20BalanceQuery";
import { useTronBalanceQuery } from "~/hooks/queries/useTronBalanceQuery";
import { useEvolu } from "~/lib/evolu";
import { allEoasQuery, normalizeAddressForQuery } from "~/lib/queries/eoa";
import { getTokenAddress, isNativeToken } from "~/lib/tokenUtils";
import { useSendStore } from "~/providers/store";
import { useTokenStore } from "~/providers/tokenStore";

const SendContent = () => {
	const { address } = useParams<{ address?: string }>();
	const evolu = useEvolu();

	// Ensure Evolu is initialized before queries (canonical pattern)
	use(evolu.appOwner);

	// Local state for EVM network selection (only used for EVM wallets)
	const [evmNetwork, setEvmNetwork] = useState<"ethereum" | "base">("base");

	const getTokensByChain = useTokenStore((state) => state.getTokensByChain);

	// Canonical Evolu pattern: useQuery with module-level query
	const allWallets = useQuery(allEoasQuery);

	// Determine which wallet to use
	const selectedWallet = address
		? allWallets.find(
				(w) =>
					w.address &&
					normalizeAddressForQuery(w.address) ===
						normalizeAddressForQuery(address),
			)
		: (allWallets.find((w) => w.isSelected === 1) ?? allWallets[0]);

	// Get the wallet's keyType and derive network
	const walletKeyType: KeyType = selectedWallet?.keyType ?? "evm";

	// Derive network from wallet type - no global state, no side effects
	// Tron wallets always use "tron", EVM wallets use local state
	const isEvmWallet = walletKeyType === "evm";
	const isTronWallet = walletKeyType === "tron";

	// Map network selection to chainId
	const chainId: SupportedChainId = isTronWallet
		? "tron"
		: evmNetwork === "ethereum"
			? 1
			: 8453;

	// Get available tokens for the selected chain
	const tokens = getTokensByChain(chainId);

	// Get selected token from Zustand store (persisted in sessionStorage)
	// Subscribe to the specific chainId's token ID to trigger re-renders when it changes
	const storedTokenId = useSendStore(
		(state) => state.selectedTokenIds[String(chainId)],
	);
	const setSelectedTokenId = useSendStore((state) => state.setSelectedTokenId);

	// Find the selected token from store, or default to first token
	const selectedToken = useMemo(() => {
		if (storedTokenId) {
			const token = tokens.find((t) => t.id === storedTokenId);
			if (token) {
				return token;
			}
		}
		// Fall back to first token if stored token not found or not available
		return tokens[0];
	}, [tokens, storedTokenId]);

	// Update stored token ID when selection changes
	const handleTokenSelect = (token: (typeof tokens)[0]) => {
		setSelectedTokenId(chainId, token.id);
	};

	// Ensure stored token ID is valid when tokens change
	useEffect(() => {
		if (tokens.length > 0 && selectedToken) {
			// If stored token is not in available tokens, update to first token
			if (storedTokenId && !tokens.find((t) => t.id === storedTokenId)) {
				setSelectedTokenId(chainId, tokens[0].id);
			}
		}
	}, [tokens, chainId, selectedToken, storedTokenId, setSelectedTokenId]);

	// Get balance based on token type
	const isNative = selectedToken && isNativeToken(selectedToken, chainId);
	const tokenAddress = selectedToken
		? getTokenAddress(selectedToken, chainId)
		: "0x0";

	const isTron = chainId === "tron";

	// EVM balance queries
	const { data: nativeBalanceData } = useBalanceQuery({
		address: selectedWallet?.address ?? "",
		chainId,
		enabled: !!selectedWallet?.address && isNative && !isTron,
	});

	const { data: erc20BalanceData } = useErc20BalanceQuery({
		address: selectedWallet?.address ?? "",
		contract: tokenAddress,
		chainId,
		enabled:
			!!selectedWallet?.address &&
			!isNative &&
			!isTron &&
			tokenAddress !== "0x0",
	});

	// Tron balance queries
	const { data: tronBalanceData } = useTronBalanceQuery({
		address: selectedWallet?.address ?? "",
		enabled: !!selectedWallet?.address && isNative && isTron,
	});

	const { data: trc20BalanceData } = useTrc20BalanceQuery({
		address: selectedWallet?.address ?? "",
		contract: tokenAddress,
		enabled:
			!!selectedWallet?.address && !isNative && isTron && tokenAddress !== "",
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

	// Determine balance based on token type and chain
	const balance = isTron
		? isNative
			? tronBalanceData?.ok && tronBalanceData.balanceSun
				? tronBalanceData.balanceSun
				: "0"
			: trc20BalanceData?.ok && trc20BalanceData.balanceRaw
				? trc20BalanceData.balanceRaw
				: "0"
		: isNative
			? nativeBalanceData?.ok && nativeBalanceData.balanceWei
				? nativeBalanceData.balanceWei
				: "0"
			: erc20BalanceData?.ok && erc20BalanceData.balanceRaw
				? erc20BalanceData.balanceRaw
				: "0";

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
									{selectedWallet.address
										? `${selectedWallet.address.slice(0, 6)}...${selectedWallet.address.slice(-4)}`
										: ""}
								</div>
								<div className="stat-desc">Balance: {balance}</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				encryptedPrivateKey &&
				selectedToken && (
					<>
						<div className="mb-4 flex items-center gap-4">
							<div className="flex-1">
								<div className="label">
									<span className="label-text">Network</span>
								</div>
								<div role="tablist" className="tabs tabs-boxed w-full">
									{isEvmWallet && (
										<>
											<button
												type="button"
												role="tab"
												className={`tab ${chainId === 1 ? "tab-active" : ""}`}
												onClick={() => setEvmNetwork("ethereum")}
												aria-label="Ethereum network"
											>
												Ethereum
											</button>
											<button
												type="button"
												role="tab"
												className={`tab ${chainId === 8453 ? "tab-active" : ""}`}
												onClick={() => setEvmNetwork("base")}
												aria-label="Base network"
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
											aria-label="Tron network"
										>
											Tron
										</button>
									)}
								</div>
							</div>
							<TokenSelector
								tokens={tokens}
								selectedToken={selectedToken}
								onSelect={handleTokenSelect}
							/>
						</div>
						<SendForm
							address={selectedWallet.address}
							balance={balance}
							encryptedPrivateKey={encryptedPrivateKey}
							token={selectedToken}
							chainId={chainId}
						/>
					</>
				)
			)}
		</div>
	);
};

export const Send = () => {
	return (
		<Suspense
			fallback={
				<div className="max-w-md mx-auto p-4">
					<div className="loading loading-spinner mx-auto" />
				</div>
			}
		>
			<SendContent />
		</Suspense>
	);
};
