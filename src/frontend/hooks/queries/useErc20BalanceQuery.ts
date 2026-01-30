import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import type { SupportedChainId } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UseErc20BalanceQueryOptions {
	address: string;
	contract: string;
	chainId: SupportedChainId;
	enabled?: boolean;
	cacheBust?: boolean;
}

export const useErc20BalanceQuery = ({
	address,
	contract,
	chainId,
	enabled = true,
	cacheBust = false,
}: UseErc20BalanceQueryOptions) => {
	const result = useQuery({
		queryKey: ["erc20Balance", address, contract, chainId],
		queryFn: async () => {
			const query: Record<string, string> = { chainId: String(chainId) };
			if (cacheBust) {
				query.cacheBust = "1";
			}
			const url = buildUrl(apiEndpoints.erc20Balance.path, {
				address,
				contract,
				query,
			});
			return api.get<ApiResponses["erc20Balance"]>(url);
		},
		enabled: enabled && Boolean(address) && Boolean(contract),
		staleTime: 1000 * 60 * 5, // 5 minutes
		gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour (serve stale data on errors)
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
