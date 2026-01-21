import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import type { SupportedChainId } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UseBalanceQueryOptions {
	address: string;
	chainId: SupportedChainId;
	enabled?: boolean;
	cacheBust?: boolean;
}

export const useBalanceQuery = ({
	address,
	chainId,
	enabled = true,
	cacheBust = false,
}: UseBalanceQueryOptions) => {
	return useQuery({
		queryKey: ["balance", address, chainId, cacheBust],
		queryFn: async () => {
			const query: Record<string, string> = { chainId: String(chainId) };
			if (cacheBust) {
				query.cacheBust = "1";
			}
			const url = buildUrl(apiEndpoints.balance.path, {
				address,
				query,
			});
			return api.get<ApiResponses["balance"]>(url);
		},
		enabled: enabled && Boolean(address),
	});
};
