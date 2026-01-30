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

	const result = useQuery({
		queryKey: ["addressReputation", walletId, address, incomingTxs],
		queryFn: () => getAddressReputation(evolu, walletId, address, incomingTxs),
		enabled: enabled && !!address,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour (serve stale data on errors)
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
	});

	// isStale: true if we're fetching/refetching after initial load
	const isStale = result.isFetching && result.dataUpdatedAt > 0;

	return {
		...result,
		isStale,
	};
};
