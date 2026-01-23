import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UseTronBalanceQueryOptions {
	address: string;
	enabled?: boolean;
	cacheBust?: boolean;
}

export const useTronBalanceQuery = ({
	address,
	enabled = true,
	cacheBust = false,
}: UseTronBalanceQueryOptions) => {
	return useQuery({
		queryKey: ["tronBalance", address, cacheBust],
		queryFn: async () => {
			const query: Record<string, string> = {};
			if (cacheBust) {
				query.cacheBust = "1";
			}
			const url = buildUrl(apiEndpoints.tronBalance.path, {
				address,
				query,
			});
			return api.get<ApiResponses["tronBalance"]>(url);
		},
		enabled: enabled && Boolean(address),
		staleTime: 1000 * 60 * 5, // 5 minutes
	});
};
