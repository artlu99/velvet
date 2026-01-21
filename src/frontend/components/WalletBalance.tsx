import { format } from "d3-format";
import type { FC } from "react";
import { useBalanceQuery } from "~/hooks/queries/useBalanceQuery";

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
		<div className="flex gap-2">
			{CHAINS.map((chain) => (
				<ChainBalance
					key={chain.id}
					address={address}
					chainId={chain.id}
					name={chain.nativeAsset}
				/>
			))}
		</div>
	);
};

interface ChainBalanceProps {
	address: string;
	chainId: 1 | 8453;
	name: string;
}

const ChainBalance: FC<ChainBalanceProps> = ({ address, chainId, name }) => {
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
		<div className="badge badge-sm" title={`${name}: ${data.balanceEth}`}>
			<span className="opacity-80">{name}</span>
			<span className="mx-1 opacity-60">·</span>
			<span className="font-mono tabular-nums">{formattedBalanceEth}</span>
		</div>
	);
};
