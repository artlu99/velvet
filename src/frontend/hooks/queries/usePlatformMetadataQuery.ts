import type { PlatformMetadataResult } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

/**
 * Fetch platform/chain metadata (including logos) from CoinGecko
 * Returns Ethereum, Base, Tron, and other chain platforms with image URLs
 * Uses 7-day cache time - platform logos rarely change
 */
export function usePlatformMetadataQuery() {
	return useQuery({
		queryKey: ["platformMetadata"],
		queryFn: async () => {
			const res = await api.get<PlatformMetadataResult>(`platforms/metadata`);
			return res;
		},
		staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days - platform logos rarely change
		gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in cache for 7 days
	});
}
