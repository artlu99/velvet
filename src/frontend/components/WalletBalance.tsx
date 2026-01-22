import { useQueryClient } from "@tanstack/react-query";
import { format } from "d3-format";
import type { FC } from "react";
import { useBalanceQuery } from "~/hooks/queries/useBalanceQuery";
import { useErc20BalanceQuery } from "~/hooks/queries/useErc20BalanceQuery";
import { getTokenDecimals } from "~/lib/tokenUtils";
import { rawToAmount } from "~/lib/transaction";
import type { CoinGeckoToken } from "~/providers/tokenStore";
import { useTokenStore } from "~/providers/tokenStore";

interface WalletBalanceProps {
	address: string;
}

const formatEth = format(".6~g");

const CHAINS: Array<{ id: 1 | 8453; name: string; nativeAsset: string }> = [
	{ id: 1, name: "ETH", nativeAsset: "ETH" },
	{ id: 8453, name: "Base", nativeAsset: "Base ETH" },
];

export const WalletBalance: FC<WalletBalanceProps> = ({ address }) => {
	return (
		<div className="flex gap-2 flex-col min-w-0 w-full">
			<div className="flex gap-2 flex-wrap min-w-0 w-full">
				{CHAINS.map((chain) => (
					<ChainBalance
						key={chain.id}
						address={address}
						chainId={chain.id}
						name={chain.nativeAsset}
					/>
				))}
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
		return Number.isFinite(n) ? formatEth(n) : data.balanceEth;
	})();

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
			<div className="badge badge-sm max-w-full">
				<span className="opacity-80 shrink-0">{name}</span>
				<span className="mx-1 opacity-60 shrink-0">·</span>
				<span className="font-mono tabular-nums truncate min-w-0">
					{formattedBalanceEth}
				</span>

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

	if (!erc20Data?.ok) {
		return null;
	}

	const decimals = getTokenDecimals(token, chainId);
	const formattedBalance = rawToAmount(erc20Data.balanceRaw, decimals);
	const label =
		chainId === 8453
			? `Base ${token.symbol.toUpperCase()}`
			: token.symbol.toUpperCase();

	return (
		<div
			className="badge badge-sm max-w-full min-w-0 overflow-hidden"
			title={`${token.name}: ${formattedBalance}`}
		>
			<span className="opacity-80 shrink-0">{label}</span>
			<span className="mx-1 opacity-60 shrink-0">·</span>
			<span className="font-mono tabular-nums truncate min-w-0">
				{formattedBalance}
			</span>
		</div>
	);
};
