import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UsePricesQueryOptions {
	readonly coinIds?: readonly string[];
	readonly enabled?: boolean;
}

export const DEFAULT_COIN_IDS = [
	"ethereum",
	"tron",
	"usd-coin",
	"tether",
] as const;

export const usePricesQuery = ({
	coinIds = DEFAULT_COIN_IDS,
	enabled = true,
}: UsePricesQueryOptions) => {
	const result = useQuery({
		queryKey: ["prices", coinIds.join(",")],
		queryFn: async () => {
			const ids = coinIds.join(",");
			const url = buildUrl(apiEndpoints.prices.path, {
				query: { ids },
			});
			return api.get<ApiResponses["prices"]>(url);
		},
		enabled: enabled && coinIds.length > 0,
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
