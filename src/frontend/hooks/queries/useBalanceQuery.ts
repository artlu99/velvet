import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import type { SupportedChainId } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UseBalanceQueryOptions {
	address: string;
	chainId: SupportedChainId;
	enabled?: boolean;
}

export const useBalanceQuery = ({
	address,
	chainId,
	enabled = true,
}: UseBalanceQueryOptions) => {
	return useQuery({
		queryKey: ["balance", address, chainId],
		queryFn: async () => {
			const url = buildUrl(apiEndpoints.balance.path, {
				address,
				query: { chainId: String(chainId) },
			});
			return api.get<ApiResponses["balance"]>(url);
		},
		enabled: enabled && Boolean(address),
	});
};
