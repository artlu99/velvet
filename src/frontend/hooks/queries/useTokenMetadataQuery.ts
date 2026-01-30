import type { TokenMetadataResult } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";
import { useEffect } from "react";
import { useTokenStore } from "~/providers/tokenStore";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UseTokenMetadataQueryOptions {
	readonly coinIds: string[];
	readonly enabled?: boolean;
}

/**
 * Fetch token metadata (including image URLs) from CoinGecko
 * Updates TokenStore with image data on success
 * Uses 24-hour cache time - token logos are static
 */
export function useTokenMetadataQuery({
	coinIds,
	enabled = true,
}: UseTokenMetadataQueryOptions) {
	const setTokenImages = useTokenStore((state) => state.setTokenImages);

	const result = useQuery({
		queryKey: ["tokenMetadata", coinIds],
		queryFn: async () => {
			const ids = coinIds.join(",");
			const res = await api.get<TokenMetadataResult>(
				`tokens/metadata?ids=${ids}`,
			);
			return res;
		},
		enabled: enabled && coinIds.length > 0,
		staleTime: 1000 * 60 * 60 * 24, // 24 hours - token logos are static
		gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
		refetchOnWindowFocus: false, // Don't refetch on focus for static data
		refetchOnReconnect: true,
	});

	// Update TokenStore when data is successfully fetched
	useEffect(() => {
		if (result.data?.ok) {
			const images: Record<
				string,
				{ thumb: string; small: string; large: string }
			> = {};
			for (const [id, token] of Object.entries(result.data.tokens)) {
				images[id] = token.image;
			}
			setTokenImages(images);
		}
	}, [result.data, setTokenImages]);

	// isStale: true if we're fetching/refetching after initial load
	const isStale = result.isFetching && result.dataUpdatedAt > 0;

	return {
		...result,
		isStale,
	};
}
