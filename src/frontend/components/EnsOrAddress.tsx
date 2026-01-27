import { unique } from "radash";
import { type FC, useState } from "react";
import { useBasenameQuery } from "~/hooks/queries/useBasenameQueries";
import { useEnsNameQuery } from "~/hooks/queries/useEnsNameQuery";

interface EnsOrAddressProps {
	address: string | null;
}

export const EnsOrAddress: FC<EnsOrAddressProps> = ({ address }) => {
	const [showRaw, setShowRaw] = useState(false);
	const { data: ensData } = useEnsNameQuery({
		address: address ?? "",
		enabled: address !== null,
	});
	const { data: basenameData } = useBasenameQuery({
		address: address ?? "",
		enabled: address !== null,
	});

	// Collect all available names in hierarchy order: ENS, Basename
	const names: string[] = [];
	if (ensData?.ok && ensData.ensName && typeof ensData.ensName === "string") {
		names.push(ensData.ensName);
	}
	if (
		basenameData?.ok &&
		basenameData.basename &&
		typeof basenameData.basename === "string"
	) {
		names.push(basenameData.basename);
	}

	// Deduplicate names since both ENS and Basename queries now use mainnet
	// and might return the same name
	const uniqueNames = unique(names);

	// Format address display: comma-separated names if available, otherwise truncated address
	const addressDisplay =
		address && uniqueNames.length > 0
			? uniqueNames.join(", ")
			: address
				? `${address.slice(0, 6)}...${address.slice(-4)}`
				: "";

	const content = (
		<div className="flex flex-col items-start gap-1">
			{/* Address/ENS name */}
			<button
				type="button"
				className="btn btn-xs btn-ghost font-mono min-w-0 block text-left"
				onClick={() => setShowRaw(!showRaw)}
			>
				{showRaw ? (address ?? "") : addressDisplay}
			</button>
		</div>
	);

	return content;
};
