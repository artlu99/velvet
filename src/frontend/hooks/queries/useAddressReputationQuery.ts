/**
 * React Query hook for address reputation
 *
 * Fetches address safety level and interaction history
 */

import { useQuery } from "@tanstack/react-query";
import { useEvolu } from "~/lib/evolu";
import { getAddressReputation } from "~/lib/queries/addressReputation";
import type { EoaId } from "~/lib/schema";

interface UseAddressReputationQueryOptions {
	walletId: EoaId;
	address: string | null;
	incomingTxs?: Array<{ from: string; value: string; timestamp: string }>;
	enabled?: boolean;
}

export const useAddressReputationQuery = ({
	walletId,
	address,
	incomingTxs,
	enabled = true,
}: UseAddressReputationQueryOptions) => {
	const evolu = useEvolu();

	return useQuery({
		queryKey: ["addressReputation", walletId, address, incomingTxs],
		queryFn: () => getAddressReputation(evolu, walletId, address, incomingTxs),
		enabled: enabled && !!address,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
};
