import { type FC, useState } from "react";
import { useEnsNameQuery } from "~/hooks/queries/useEnsNameQuery";

interface EnsOrAddressProps {
	address: string;
}

export const EnsOrAddress: FC<EnsOrAddressProps> = ({ address }) => {
	const [showRaw, setShowRaw] = useState(false);
	const { data: ensData } = useEnsNameQuery({ address });

	// Format address display: ENS name if available, otherwise truncated address
	const addressDisplay =
		ensData?.ok && ensData.ensName
			? ensData.ensName
			: `${address.slice(0, 6)}...${address.slice(-4)}`;

	return (
		<button
			type="button"
			className="btn btn-xs btn-ghost"
			onClick={() => setShowRaw(!showRaw)}
		>
			<span className="font-mono block min-w-0">
				{showRaw ? address : addressDisplay}
			</span>
		</button>
	);
};
