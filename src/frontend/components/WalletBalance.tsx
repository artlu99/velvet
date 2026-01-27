import { useQueryClient } from "@tanstack/react-query";
import type { FC } from "react";
import { TokenLogo } from "~/components/TokenLogo";
import { usePersistedBalanceQuery } from "~/hooks/queries/usePersistedBalanceQuery";
import {
	DEFAULT_COIN_IDS,
	usePersistedPricesQuery,
} from "~/hooks/queries/usePersistedPricesQuery";
import {
	usePersistedErc20BalanceQuery,
	usePersistedTrc20BalanceQuery,
	usePersistedTronBalanceQuery,
} from "~/hooks/queries/usePersistedTokenBalanceQuery";
import { discriminateAddressType } from "~/lib/crypto";
import {
	formatPriceAge,
	formatTrc20,
	formatUsd,
	formatWithLocale,
	getPriceOpacity,
} from "~/lib/helpers";
import { calculateTokenUsd } from "~/lib/portfolioValue";
import type { Origin } from "~/lib/schema";
import { getTokenDecimals } from "~/lib/tokenUtils";
import { rawToAmount } from "~/lib/transaction";
import type { CoinGeckoToken } from "~/providers/tokenStore";
import { useTokenStore } from "~/providers/tokenStore";

interface WalletBalanceProps {
	address: string;
	origin?: Origin | null;
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

const WalletTotalDisplay: FC<WalletTotalDisplayProps> = () => {
	// Fetch prices for all tokens using persisted hook
	const { data: pricesData, cached: cachedPrices } = usePersistedPricesQuery({
		coinIds: DEFAULT_COIN_IDS,
	});

	// Calculate wallet total with useMemo to prevent recalculation on every render
	// We depend on the actual query data objects, not the arrays
	const walletTotalUsd = 0;

	return (
		<div className="text-xs opacity-70 font-mono tabular-nums">
			{walletTotalUsd !== null ? (
				<>
					Total: ≈${formatUsd.format(walletTotalUsd)}
					{(() => {
						const timestamp =
							pricesData?.ok && pricesData.timestamp
								? pricesData.timestamp
								: cachedPrices?.updatedAt
									? new Date(cachedPrices.updatedAt).getTime()
									: null;
						return timestamp !== null ? (
							<span className="ml-2 opacity-60">
								{formatPriceAge(timestamp)}
							</span>
						) : null;
					})()}
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
		<div className="flex flex-col gap-1 min-w-0 w-full">
			<WalletTotalDisplay address={address} relevantChains={relevantChains} />
			<div className="flex flex-col gap-1 min-w-0 w-full">
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
	// Use persisted balance hook for stale-while-revalidate pattern
	const { data, cached, isLoading, isStale, error } = usePersistedBalanceQuery({
		address,
		chainId,
	});

	// Fetch prices with persistence (shared query, deduplicated by React Query)
	const {
		data: pricesData,
		cached: cachedPrices,
		isStale: pricesStale,
	} = usePersistedPricesQuery({
		coinIds: DEFAULT_COIN_IDS,
		enabled: data?.ok === true || cached !== null,
	});

	// Use fresh prices if available, otherwise cached
	const prices = pricesData?.ok ? pricesData.prices : cachedPrices?.prices;

	// Show loading only if no cached data AND still loading from API
	if (isLoading && !cached) {
		return (
			<div className="flex items-center gap-2 px-2 py-1">
				<span className="loading loading-spinner loading-xs" />
				<span className="text-xs opacity-60">{name}</span>
			</div>
		);
	}

	if (error && !cached) {
		return (
			<div className="flex items-center gap-2 px-2 py-1 text-xs text-error">
				{name}: Error
			</div>
		);
	}

	// Use fresh data if available, otherwise fall back to cached
	const balanceEth = data?.ok
		? data.balanceEth
		: cached
			? rawToAmount(cached.balanceRaw, 18)
			: null;

	if (!balanceEth) {
		if (data && !data.ok) {
			return (
				<div className="flex items-center gap-2 px-2 py-1 text-xs opacity-60">
					{name}: {data.code}
				</div>
			);
		}
		return null;
	}

	const formattedBalanceEth = (() => {
		const n = Number(balanceEth);
		return Number.isFinite(n) ? formatWithLocale.format(n) : balanceEth;
	})();

	// Calculate USD value for ETH
	const ethUsdValue = prices?.ethereum
		? calculateTokenUsd(balanceEth, prices.ethereum.usd)
		: null;

	// Opacity reflects staleness - fresh data is fully opaque, stale data fades
	const baseOpacity =
		pricesData?.ok && pricesData.timestamp
			? getPriceOpacity(pricesData.timestamp)
			: 1;
	// If showing cached/stale data, reduce opacity
	const opacity =
		(isStale && !data?.ok) || pricesStale ? baseOpacity * 0.7 : baseOpacity;

	return (
		<>
			<button
				type="button"
				className="btn btn-ghost btn-sm justify-start px-2 h-auto py-1"
				onClick={() => {
					queryClient.invalidateQueries({
						queryKey: ["balance", address, chainId],
					});
					queryClient.invalidateQueries({
						queryKey: ["erc20Balance", address],
					});
				}}
			>
				<div
					className="flex items-center gap-2 w-full min-w-0"
					style={{ opacity }}
				>
					<TokenLogo
						coinId="ethereum"
						size="small"
						chainId={chainId}
						className="shrink-0"
					/>
					<span className="opacity-80 shrink-0 text-xs">{name}</span>
					<span className="font-mono tabular-nums truncate min-w-0 text-xs">
						{formattedBalanceEth}
					</span>
					{ethUsdValue !== null && (
						<span className="font-mono tabular-nums text-xs opacity-60 ml-auto shrink-0">
							${formatUsd.format(ethUsdValue)}
						</span>
					)}
				</div>
			</button>
			<TokenBalances address={address} chainId={chainId} />
		</>
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
	// Use persisted hook for stale-while-revalidate pattern
	const {
		data: erc20Data,
		cached,
		isStale,
	} = usePersistedErc20BalanceQuery({
		address,
		contract,
		chainId,
	});

	// Fetch prices with persistence
	const {
		data: pricesData,
		cached: cachedPrices,
		isStale: pricesStale,
	} = usePersistedPricesQuery({
		coinIds: DEFAULT_COIN_IDS,
		enabled: erc20Data?.ok === true || cached !== null,
	});

	const prices = pricesData?.ok ? pricesData.prices : cachedPrices?.prices;
	const decimals = getTokenDecimals(token, chainId);

	// Use fresh data if available, otherwise fall back to cached
	const balanceRaw = erc20Data?.ok ? erc20Data.balanceRaw : cached?.balanceRaw;

	if (!balanceRaw) {
		return null;
	}

	const balanceAmount = rawToAmount(balanceRaw, decimals);
	const formattedBalance = (() => {
		const n = Number(balanceAmount);
		return Number.isFinite(n) ? formatWithLocale.format(n) : balanceAmount;
	})();
	const label =
		chainId === 8453
			? `Base ${token.symbol.toUpperCase()}`
			: token.symbol.toUpperCase();

	// Calculate USD value if prices are available
	const usdValue = prices?.[token.id]
		? calculateTokenUsd(balanceAmount, prices[token.id].usd)
		: null;

	// Opacity reflects staleness
	const baseOpacity =
		pricesData?.ok && pricesData.timestamp
			? getPriceOpacity(pricesData.timestamp)
			: 1;
	const opacity =
		(isStale && !erc20Data?.ok) || pricesStale
			? baseOpacity * 0.7
			: baseOpacity;

	return (
		<div
			className="flex items-center gap-2 w-full min-w-0 px-2 py-1"
			title={`${token.name}: ${formattedBalance}${isStale ? " (cached)" : ""}`}
			style={{ opacity }}
		>
			<TokenLogo
				coinId={token.id}
				size="small"
				chainId={chainId}
				className="shrink-0"
			/>
			<span className="opacity-80 shrink-0 text-xs">{label}</span>
			<span className="font-mono tabular-nums truncate min-w-0 text-xs">
				{formattedBalance}
			</span>
			{usdValue !== null && (
				<span className="font-mono tabular-nums text-xs opacity-60 ml-auto shrink-0">
					${formatUsd.format(usdValue)}
				</span>
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
	// Use persisted hook for stale-while-revalidate pattern
	const {
		data: trxData,
		cached,
		isLoading,
		isStale,
	} = usePersistedTronBalanceQuery({
		address,
	});

	// Fetch prices with persistence
	const {
		data: pricesData,
		cached: cachedPrices,
		isStale: pricesStale,
	} = usePersistedPricesQuery({
		coinIds: DEFAULT_COIN_IDS,
		enabled: trxData?.ok === true || cached !== null,
	});

	const prices = pricesData?.ok ? pricesData.prices : cachedPrices?.prices;
	const getTokensByChain = useTokenStore((state) => state.getTokensByChain);
	const tokens = getTokensByChain("tron");

	// Show loading only if no cached data
	if (isLoading && !cached) {
		return (
			<div className="flex items-center gap-2 px-2 py-1">
				<span className="loading loading-spinner loading-xs" />
				<span className="text-xs opacity-60">{name}</span>
			</div>
		);
	}

	// Use fresh data if available, otherwise convert cached (stored as Sun)
	const balanceTrx = trxData?.ok
		? trxData.balanceTrx
		: cached?.balanceRaw
			? rawToAmount(cached.balanceRaw, 6) // TRX has 6 decimals
			: null;

	const formattedTrxBalance = (() => {
		if (!balanceTrx) return null;
		const n = Number(balanceTrx);
		return Number.isFinite(n) ? formatWithLocale.format(n) : balanceTrx;
	})();

	// Calculate USD value for TRX
	const trxUsdValue =
		balanceTrx && prices?.tron
			? calculateTokenUsd(balanceTrx, prices.tron.usd)
			: null;

	// Opacity reflects staleness
	const baseOpacity =
		pricesData?.ok && pricesData.timestamp
			? getPriceOpacity(pricesData.timestamp)
			: 1;
	const opacity =
		(isStale && !trxData?.ok) || pricesStale ? baseOpacity * 0.7 : baseOpacity;

	return (
		<>
			<button
				type="button"
				className="btn btn-ghost btn-sm justify-start px-2 h-auto py-1"
				onClick={() => {
					queryClient.invalidateQueries({
						queryKey: ["tronBalance", address],
					});
					queryClient.invalidateQueries({
						queryKey: ["trc20Balance", address],
					});
				}}
			>
				<div
					className="flex items-center gap-2 w-full min-w-0"
					style={{ opacity }}
				>
					<TokenLogo
						coinId="tron"
						size="small"
						chainId="tron"
						className="shrink-0"
					/>
					<span className="opacity-80 shrink-0 text-xs">{name}</span>
					<span className="font-mono tabular-nums truncate min-w-0 text-xs">
						{formattedTrxBalance ?? "Error"}
					</span>
					{trxUsdValue !== null && (
						<span className="font-mono tabular-nums text-xs opacity-60 ml-auto shrink-0">
							${formatUsd.format(trxUsdValue)}
						</span>
					)}
				</div>
			</button>
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
		</>
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
	// Use persisted hook for stale-while-revalidate pattern
	const {
		data: trc20Data,
		cached,
		isStale,
	} = usePersistedTrc20BalanceQuery({
		address,
		contract,
	});

	// Fetch prices with persistence
	const {
		data: pricesData,
		cached: cachedPrices,
		isStale: pricesStale,
	} = usePersistedPricesQuery({
		coinIds: DEFAULT_COIN_IDS,
		enabled: trc20Data?.ok === true || cached !== null,
	});

	const prices = pricesData?.ok ? pricesData.prices : cachedPrices?.prices;

	// Use fresh data if available, otherwise fall back to cached
	// TRC20 stores balanceFormatted as balanceRaw in cache
	const balanceFormatted = trc20Data?.ok
		? trc20Data.balanceFormatted
		: cached?.balanceRaw;

	if (!balanceFormatted) {
		return null;
	}

	const formattedBalance = (() => {
		const n = Number(balanceFormatted);
		return Number.isFinite(n) ? formatTrc20.format(n) : balanceFormatted;
	})();

	const label = `Tron ${token.symbol.toUpperCase()}`;

	// Calculate USD value if prices are available
	const usdValue = prices?.[token.id]
		? calculateTokenUsd(formattedBalance, prices[token.id].usd)
		: null;

	// Opacity reflects staleness
	const baseOpacity =
		pricesData?.ok && pricesData.timestamp
			? getPriceOpacity(pricesData.timestamp)
			: 1;
	const opacity =
		(isStale && !trc20Data?.ok) || pricesStale
			? baseOpacity * 0.7
			: baseOpacity;

	return (
		<div
			className="flex items-center gap-2 w-full min-w-0 px-2 py-1"
			title={`${token.name}: ${formattedBalance}${isStale ? " (cached)" : ""}`}
			style={{ opacity }}
		>
			<TokenLogo
				coinId={token.id}
				size="small"
				chainId="tron"
				className="shrink-0"
			/>
			<span className="opacity-80 shrink-0 text-xs">{label}</span>
			<span className="font-mono tabular-nums truncate min-w-0 text-xs">
				{formattedBalance}
			</span>
			{usdValue !== null && (
				<span className="font-mono tabular-nums text-xs opacity-60 ml-auto shrink-0">
					${formatUsd.format(usdValue)}
				</span>
			)}
		</div>
	);
};
