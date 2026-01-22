import type { FC } from "react";
import { useEnsNameQuery } from "~/hooks/queries/useEnsNameQuery";

interface EnsOrAddressProps {
	address: string;
}

export const EnsOrAddress: FC<EnsOrAddressProps> = ({ address }) => {
	const { data: ensData } = useEnsNameQuery({ address });

	// Format address display: ENS name if available, otherwise truncated address
	const addressDisplay =
		ensData?.ok && ensData.ensName
			? ensData.ensName
			: `${address.slice(0, 6)}...${address.slice(-4)}`;

	return (
		<span className="font-mono truncate block min-w-0">{addressDisplay}</span>
	);
};
