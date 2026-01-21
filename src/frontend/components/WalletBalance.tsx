import type { FC } from "react";
import { useBalanceQuery } from "~/hooks/queries/useBalanceQuery";

interface WalletBalanceProps {
	address: string;
}

const CHAINS: Array<{ id: 1 | 8453; name: string; color: string }> = [
	{ id: 1, name: "ETH", color: "badge-primary" },
	{ id: 8453, name: "Base", color: "badge-secondary" },
];

export const WalletBalance: FC<WalletBalanceProps> = ({ address }) => {
	return (
		<div className="flex gap-2">
			{CHAINS.map((chain) => (
				<ChainBalance
					key={chain.id}
					address={address}
					chainId={chain.id}
					name={chain.name}
					badgeColor={chain.color}
				/>
			))}
		</div>
	);
};

interface ChainBalanceProps {
	address: string;
	chainId: 1 | 8453;
	name: string;
	badgeColor: string;
}

const ChainBalance: FC<ChainBalanceProps> = ({
	address,
	chainId,
	name,
	badgeColor,
}) => {
	const { data, isLoading, error } = useBalanceQuery({ address, chainId });

	if (isLoading) {
		return (
			<div className={`badge ${badgeColor} badge-sm badge-outline`}>
				<span className="loading loading-spinner loading-xs mr-1" />
				{name}
			</div>
		);
	}

	if (error) {
		return <div className={`badge ${badgeColor} badge-sm`}>{name}: Error</div>;
	}

	if (!data) {
		return null;
	}

	if (!data.ok) {
		return (
			<div className={`badge ${badgeColor} badge-sm badge-ghost`}>
				{name}: {data.code}
			</div>
		);
	}

	return (
		<div className={`badge ${badgeColor} badge-sm`}>
			{name}: {data.balanceEth}
		</div>
	);
};
