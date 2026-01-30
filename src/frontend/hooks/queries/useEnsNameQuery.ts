import { useQuery } from "@tanstack/react-query";
import { createPublicClient, fallback, isAddress, webSocket } from "viem";
import { mainnet } from "viem/chains";
import { ENS_WSS_URLS } from "~/lib/constants";

let ensClient: ReturnType<typeof createPublicClient> | null = null;

function getEnsClient() {
	if (!ensClient) {
		ensClient = createPublicClient({
			chain: mainnet,
			transport: fallback(ENS_WSS_URLS.map((url) => webSocket(url))),
		});
	}
	return ensClient;
}

interface UseEnsNameQueryOptions {
	address: string;
	enabled?: boolean;
}

/**
 * Reverse lookup: address → ENS name
 * Returns the primary ENS (.eth) name for an address
 * Uses 8-hour cache with stale-while-revalidate
 */
export const useEnsNameQuery = ({
	address,
	enabled = true,
}: UseEnsNameQueryOptions) => {
	return useQuery({
		queryKey: ["ens", address],
		queryFn: async () => {
			const client = getEnsClient();
			const ensName = await client.getEnsName({
				address: address as `0x${string}`,
			});

			return {
				ok: true,
				address,
				ensName,
				timestamp: Date.now(),
			} as const;
		},
		enabled: enabled && Boolean(address) && isAddress(address as `0x${string}`),
		staleTime: 1000 * 60 * 60 * 24, // 24 hours - trust our cache more
		gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in memory for 7 days
		retry: 1,
	});
};
