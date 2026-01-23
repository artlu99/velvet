import { useQueries, useQueryClient } from "@tanstack/react-query";
import { type FC, useMemo } from "react";
import { useBalanceQuery } from "~/hooks/queries/useBalanceQuery";
import { useErc20BalanceQuery } from "~/hooks/queries/useErc20BalanceQuery";
import {
	DEFAULT_COIN_IDS,
	usePricesQuery,
} from "~/hooks/queries/usePricesQuery";
import { useTrc20BalanceQuery } from "~/hooks/queries/useTrc20BalanceQuery";
import { useTronBalanceQuery } from "~/hooks/queries/useTronBalanceQuery";
import { discriminateAddressType } from "~/lib/crypto";
import {
	formatPriceAge,
	formatTrc20,
	formatUsd,
	formatWithLocale,
	getPriceOpacity,
} from "~/lib/helpers";
import { calculateTokenUsd } from "~/lib/portfolioValue";
import { getTokenDecimals } from "~/lib/tokenUtils";
import { rawToAmount } from "~/lib/transaction";
import type { CoinGeckoToken } from "~/providers/tokenStore";
import { useTokenStore } from "~/providers/tokenStore";

interface WalletBalanceProps {
	address: string;
}

const CHAINS: Array<
	| { id: 1 | 8453; name: string; nativeAsset: string }
	| { id: "tron"; name: string; nativeAsset: string }
> = [
	{ id: 1, name: "ETH", nativeAsset: "ETH" },
	{ id: 8453, name: "Base", nativeAsset: "Base ETH" },
	{ id: "tron", name: "Tron", nativeAsset: "TRX" },
];

interface WalletTotalDisplayProps {
	readonly address: string;
	readonly relevantChains: ReadonlyArray<(typeof CHAINS)[number]>;
}

const WalletTotalDisplay: FC<WalletTotalDisplayProps> = ({
	address,
	relevantChains,
}) => {
	// Fetch prices for all tokens
	const { data: pricesData } = usePricesQuery({
		coinIds: DEFAULT_COIN_IDS,
	});

	// Get all tokens for this wallet
	const getTokensByChain = useTokenStore((state) => state.getTokensByChain);

	// Query all native balances for this address
	const ethBalance = useBalanceQuery({
		address,
		chainId: 1,
		enabled: relevantChains.some((c) => c.id === 1),
	});

	const baseBalance = useBalanceQuery({
		address,
		chainId: 8453,
		enabled: relevantChains.some((c) => c.id === 8453),
	});

	const trxBalance = useTronBalanceQuery({
		address,
		enabled: relevantChains.some((c) => c.id === "tron"),
	});

	// Query all ERC20 balances for this address
	const ethTokens = getTokensByChain(1);
	const baseTokens = getTokensByChain(8453);
	const tronTokens = getTokensByChain("tron");

	const erc20Balances = useQueries({
		queries: [
			...ethTokens.map((token) => ({
				queryKey: ["erc20Balance", address, token.platforms.ethereum, 1],
				enabled: relevantChains.some((c) => c.id === 1),
				staleTime: 1000 * 60 * 5, // 5 minutes
			})),
			...baseTokens.map((token) => ({
				queryKey: ["erc20Balance", address, token.platforms.base, 8453],
				enabled: relevantChains.some((c) => c.id === 8453),
				staleTime: 1000 * 60 * 5, // 5 minutes
			})),
		],
	}) as Array<{
		data?: { ok: boolean; balanceRaw: string };
	}>;

	const trc20Balances = useQueries({
		queries: tronTokens.map((token) => ({
			queryKey: ["trc20Balance", address, token.platforms.tron],
			enabled: relevantChains.some((c) => c.id === "tron"),
			staleTime: 1000 * 60 * 5, // 5 minutes
		})),
	}) as Array<{
		data?: { ok: boolean; balanceFormatted: string };
	}>;

	// Calculate wallet total
	const walletTotalUsd = useMemo(() => {
		if (!pricesData?.ok || !pricesData.prices) return null;

		let total = 0;

		// Add native ETH if loaded
		if (
			ethBalance.data?.ok &&
			pricesData.prices.ethereum &&
			relevantChains.some((c) => c.id === 1)
		) {
			total += calculateTokenUsd(
				ethBalance.data.balanceEth,
				pricesData.prices.ethereum.usd,
			);
		}

		// Add native Base ETH if loaded
		if (
			baseBalance.data?.ok &&
			pricesData.prices.ethereum &&
			relevantChains.some((c) => c.id === 8453)
		) {
			total += calculateTokenUsd(
				baseBalance.data.balanceEth,
				pricesData.prices.ethereum.usd,
			);
		}

		// Add native TRX if loaded
		if (
			trxBalance.data?.ok &&
			pricesData.prices.tron &&
			relevantChains.some((c) => c.id === "tron")
		) {
			total += calculateTokenUsd(
				trxBalance.data.balanceTrx,
				pricesData.prices.tron.usd,
			);
		}

		// Add ERC20 tokens
		for (let i = 0; i < ethTokens.length; i++) {
			const token = ethTokens[i];
			const balance = erc20Balances[i].data;
			if (balance?.ok && pricesData.prices[token.id]) {
				const decimals = token.detail_platforms.ethereum?.decimal_place ?? 18;
				const balanceAmount = rawToAmount(balance.balanceRaw, decimals);
				total += calculateTokenUsd(
					balanceAmount,
					pricesData.prices[token.id].usd,
				);
			}
		}

		for (let i = 0; i < baseTokens.length; i++) {
			const token = baseTokens[i];
			const balance = erc20Balances[ethTokens.length + i].data;
			if (balance?.ok && pricesData.prices[token.id]) {
				const decimals = token.detail_platforms.base?.decimal_place ?? 18;
				const balanceAmount = rawToAmount(balance.balanceRaw, decimals);
				total += calculateTokenUsd(
					balanceAmount,
					pricesData.prices[token.id].usd,
				);
			}
		}

		// Add TRC20 tokens
		for (let i = 0; i < tronTokens.length; i++) {
			const token = tronTokens[i];
			const balance = trc20Balances[i].data;
			if (balance?.ok && pricesData.prices[token.id]) {
				total += calculateTokenUsd(
					balance.balanceFormatted,
					pricesData.prices[token.id].usd,
				);
			}
		}

		return total;
	}, [
		pricesData,
		ethBalance.data,
		baseBalance.data,
		trxBalance.data,
		erc20Balances,
		trc20Balances,
		ethTokens,
		baseTokens,
		tronTokens,
		relevantChains,
	]);

	// Get all wallet totals from the store
	// Note: This is a simplified approach. In a real app, you'd want to track totals per address.
	// For now, we'll just update the global total when the current wallet's total changes.

	return (
		<div className="text-xs opacity-70 font-mono tabular-nums">
			{walletTotalUsd !== null ? (
				<>
					Total: ≈${formatUsd.format(walletTotalUsd)}
					{pricesData?.ok && pricesData.timestamp && (
						<span className="ml-2 opacity-60">
							{formatPriceAge(pricesData.timestamp)}
						</span>
					)}
				</>
			) : (
				<span className="loading loading-spinner loading-xs" />
			)}
		</div>
	);
};

export const WalletBalance: FC<WalletBalanceProps> = ({ address }) => {
	const addressType = discriminateAddressType(address);

	// Filter chains based on address type
	const relevantChains = CHAINS.filter((chain) => {
		if (addressType.type === "unknown") {
			return false; // Don't show balances for unknown address types
		}
		if (addressType.type === "evm") {
			// EVM addresses only show EVM chains (ETH, Base)
			return chain.id !== "tron";
		}
		if (addressType.type === "tron") {
			// Tron addresses only show Tron chain
			return chain.id === "tron";
		}
		return false;
	});

	if (relevantChains.length === 0) {
		return null;
	}

	return (
		<div className="flex gap-2 flex-col min-w-0 w-full">
			<WalletTotalDisplay address={address} relevantChains={relevantChains} />
			<div className="flex gap-2 flex-wrap min-w-0 w-full">
				{relevantChains.map((chain) =>
					chain.id === "tron" ? (
						<TronChainBalance
							key={chain.id}
							address={address}
							name={chain.nativeAsset}
						/>
					) : (
						<ChainBalance
							key={chain.id}
							address={address}
							chainId={chain.id}
							name={chain.nativeAsset}
						/>
					),
				)}
			</div>
		</div>
	);
};

interface ChainBalanceProps {
	address: string;
	chainId: 1 | 8453;
	name: string;
}

const ChainBalance: FC<ChainBalanceProps> = ({ address, chainId, name }) => {
	const queryClient = useQueryClient();
	const { data, isLoading, error } = useBalanceQuery({ address, chainId });

	// Fetch prices for all tokens (shared query, deduplicated by React Query)
	const { data: pricesData } = usePricesQuery({
		coinIds: DEFAULT_COIN_IDS,
		enabled: data?.ok === true,
	});

	if (isLoading) {
		return (
			<div className="badge badge-sm badge-outline">
				<span className="loading loading-spinner loading-xs mr-1" />
				{name}
			</div>
		);
	}

	if (error) {
		return <div className="badge badge-sm">{name}: Error</div>;
	}

	if (!data) {
		return null;
	}

	if (!data.ok) {
		return (
			<div className="badge badge-sm badge-ghost">
				{name}: {data.code}
			</div>
		);
	}

	const formattedBalanceEth = (() => {
		const n = Number(data.balanceEth);
		return Number.isFinite(n) ? formatWithLocale.format(n) : data.balanceEth;
	})();

	// Calculate USD value for ETH
	const ethUsdValue =
		pricesData?.ok && pricesData.prices.ethereum
			? calculateTokenUsd(data.balanceEth, pricesData.prices.ethereum.usd)
			: null;

	const opacity =
		pricesData?.ok && pricesData.timestamp
			? getPriceOpacity(pricesData.timestamp)
			: 1;

	return (
		<button
			type="button"
			className="btn btn-ghost "
			onClick={() => {
				queryClient.invalidateQueries({
					queryKey: ["balance", address, chainId],
				});
				queryClient.invalidateQueries({
					queryKey: ["erc20Balance", address],
				});
			}}
		>
			<div className="badge badge-sm max-w-full" style={{ opacity }}>
				<span className="opacity-80 shrink-0">{name}</span>
				<span className="mx-1 opacity-60 shrink-0">·</span>
				<span className="font-mono tabular-nums truncate min-w-0">
					{formattedBalanceEth}
				</span>
				{ethUsdValue !== null && (
					<>
						<span className="mx-1 opacity-60 shrink-0">≈</span>
						<span className="font-mono tabular-nums truncate min-w-0">
							${formatUsd.format(ethUsdValue)}
						</span>
					</>
				)}

				<TokenBalances address={address} chainId={chainId} />
			</div>
		</button>
	);
};

interface TokenBalancesProps {
	address: string;
	chainId: 1 | 8453;
}

const TokenBalances: FC<TokenBalancesProps> = ({ address, chainId }) => {
	const getTokensByChain = useTokenStore((state) => state.getTokensByChain);
	const tokens = getTokensByChain(chainId);

	return (
		<>
			{tokens.map((token) => {
				const tokenAddress =
					token.platforms[chainId === 1 ? "ethereum" : "base"];
				if (!tokenAddress) return null; // Skip native tokens

				return (
					<TokenBalance
						key={token.id}
						address={address}
						contract={tokenAddress}
						chainId={chainId}
						token={token}
					/>
				);
			})}
		</>
	);
};

interface TokenBalanceProps {
	address: string;
	contract: string;
	chainId: 1 | 8453;
	token: CoinGeckoToken;
}

const TokenBalance: FC<TokenBalanceProps> = ({
	address,
	contract,
	chainId,
	token,
}) => {
	const { data: erc20Data } = useErc20BalanceQuery({
		address,
		contract,
		chainId,
	});

	// Fetch prices for all tokens (shared query, deduplicated by React Query)
	const { data: pricesData } = usePricesQuery({
		coinIds: DEFAULT_COIN_IDS,
		enabled: erc20Data?.ok === true,
	});

	if (!erc20Data?.ok) {
		return null;
	}

	const decimals = getTokenDecimals(token, chainId);
	const balanceAmount = rawToAmount(erc20Data.balanceRaw, decimals);
	const formattedBalance = (() => {
		const n = Number(balanceAmount);
		return Number.isFinite(n) ? formatWithLocale.format(n) : balanceAmount;
	})();
	const label =
		chainId === 8453
			? `Base ${token.symbol.toUpperCase()}`
			: token.symbol.toUpperCase();

	// Calculate USD value if prices are available
	const usdValue =
		pricesData?.ok && pricesData.prices[token.id]
			? calculateTokenUsd(balanceAmount, pricesData.prices[token.id].usd)
			: null;

	const opacity =
		pricesData?.ok && pricesData.timestamp
			? getPriceOpacity(pricesData.timestamp)
			: 1;

	return (
		<div
			className="badge badge-sm max-w-full min-w-0 overflow-hidden"
			title={`${token.name}: ${formattedBalance}`}
			style={{ opacity }}
		>
			<span className="opacity-80 shrink-0">{label}</span>
			<span className="mx-1 opacity-60 shrink-0">·</span>
			<span className="font-mono tabular-nums truncate min-w-0">
				{formattedBalance}
			</span>
			{usdValue !== null && (
				<>
					<span className="mx-1 opacity-60 shrink-0">≈</span>
					<span className="font-mono tabular-nums truncate min-w-0">
						${formatUsd.format(usdValue)}
					</span>
				</>
			)}
		</div>
	);
};

interface TronChainBalanceProps {
	address: string;
	name: string;
}

const TronChainBalance: FC<TronChainBalanceProps> = ({ address, name }) => {
	const queryClient = useQueryClient();
	const { data: trxData, isLoading: trxLoading } = useTronBalanceQuery({
		address,
	});

	// Fetch prices for all tokens (shared query, deduplicated by React Query)
	const { data: pricesData } = usePricesQuery({
		coinIds: DEFAULT_COIN_IDS,
		enabled: trxData?.ok === true,
	});

	const getTokensByChain = useTokenStore((state) => state.getTokensByChain);
	const tokens = getTokensByChain("tron");

	if (trxLoading) {
		return (
			<div className="badge badge-sm badge-outline">
				<span className="loading loading-spinner loading-xs mr-1" />
				{name}
			</div>
		);
	}

	const formattedTrxBalance = (() => {
		if (!trxData?.ok) return null;
		const n = Number(trxData.balanceTrx);
		return Number.isFinite(n) ? formatWithLocale.format(n) : trxData.balanceTrx;
	})();

	// Calculate USD value for TRX
	const trxUsdValue =
		trxData?.ok && pricesData?.ok && pricesData.prices.tron
			? calculateTokenUsd(trxData.balanceTrx, pricesData.prices.tron.usd)
			: null;

	const opacity =
		pricesData?.ok && pricesData.timestamp
			? getPriceOpacity(pricesData.timestamp)
			: 1;

	return (
		<button
			type="button"
			className="btn btn-ghost "
			onClick={() => {
				queryClient.invalidateQueries({
					queryKey: ["tronBalance", address],
				});
				queryClient.invalidateQueries({
					queryKey: ["trc20Balance", address],
				});
			}}
		>
			<div className="badge badge-sm max-w-full" style={{ opacity }}>
				<span className="opacity-80 shrink-0">{name}</span>
				<span className="mx-1 opacity-60 shrink-0">·</span>
				<span className="font-mono tabular-nums truncate min-w-0">
					{formattedTrxBalance ?? "Error"}
				</span>
				{trxUsdValue !== null && (
					<>
						<span className="mx-1 opacity-60 shrink-0">≈</span>
						<span className="font-mono tabular-nums truncate min-w-0">
							${formatUsd.format(trxUsdValue)}
						</span>
					</>
				)}

				{tokens.map((token) => {
					const tokenAddress = token.platforms.tron;
					if (!tokenAddress) return null; // Skip native tokens

					return (
						<TronTokenBalance
							key={token.id}
							address={address}
							contract={tokenAddress}
							token={token}
						/>
					);
				})}
			</div>
		</button>
	);
};

interface TronTokenBalanceProps {
	address: string;
	contract: string;
	token: CoinGeckoToken;
}

const TronTokenBalance: FC<TronTokenBalanceProps> = ({
	address,
	contract,
	token,
}) => {
	const { data: trc20Data } = useTrc20BalanceQuery({
		address,
		contract,
	});

	// Fetch prices for all tokens (shared query, deduplicated by React Query)
	const { data: pricesData } = usePricesQuery({
		coinIds: DEFAULT_COIN_IDS,
		enabled: trc20Data?.ok === true,
	});

	if (!trc20Data?.ok) {
		return null;
	}

	const formattedBalance = (() => {
		const n = Number(trc20Data.balanceFormatted);
		return Number.isFinite(n)
			? formatTrc20.format(n)
			: trc20Data.balanceFormatted;
	})();

	const label = `Tron ${token.symbol.toUpperCase()}`;

	// Calculate USD value if prices are available
	const usdValue =
		pricesData?.ok && pricesData.prices[token.id]
			? calculateTokenUsd(formattedBalance, pricesData.prices[token.id].usd)
			: null;

	const opacity =
		pricesData?.ok && pricesData.timestamp
			? getPriceOpacity(pricesData.timestamp)
			: 1;

	return (
		<div
			className="badge badge-sm max-w-full min-w-0 overflow-hidden"
			title={`${token.name}: ${formattedBalance}`}
			style={{ opacity }}
		>
			<span className="opacity-80 shrink-0">{label}</span>
			<span className="mx-1 opacity-60 shrink-0">·</span>
			<span className="font-mono tabular-nums truncate min-w-0">
				{formattedBalance}
			</span>
			{usdValue !== null && (
				<>
					<span className="mx-1 opacity-60 shrink-0">≈</span>
					<span className="font-mono tabular-nums truncate min-w-0">
						${formatUsd.format(usdValue)}
					</span>
				</>
			)}
		</div>
	);
};
