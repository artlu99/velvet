import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UseTrc20BalanceQueryOptions {
	address: string;
	contract: string;
	enabled?: boolean;
	cacheBust?: boolean;
}

export const useTrc20BalanceQuery = ({
	address,
	contract,
	enabled = true,
	cacheBust = false,
}: UseTrc20BalanceQueryOptions) => {
	return useQuery({
		queryKey: ["trc20Balance", address, contract, cacheBust],
		queryFn: async () => {
			const query: Record<string, string> = {};
			if (cacheBust) {
				query.cacheBust = "1";
			}
			const url = buildUrl(apiEndpoints.trc20Balance.path, {
				address,
				contract,
				query,
			});
			return api.get<ApiResponses["trc20Balance"]>(url);
		},
		enabled: enabled && Boolean(address) && Boolean(contract),
		staleTime: 1000 * 60 * 5, // 5 minutes
	});
};
