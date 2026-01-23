import { type ApiResponses, apiEndpoints, buildUrl } from "@shared/api";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";
import { isAddress } from "viem";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UseEnsNameQueryOptions {
	address: string;
	enabled?: boolean;
}

export const useEnsNameQuery = ({
	address,
	enabled = true,
}: UseEnsNameQueryOptions) => {
	return useQuery({
		queryKey: ["ens", address],
		queryFn: async () => {
			const url = buildUrl(apiEndpoints.ensName.path, { address });
			return api.get<ApiResponses["ensName"]>(url);
		},
		// ENS only works for EVM addresses, disable for Tron (base58)
		enabled: enabled && Boolean(address) && isAddress(address as `0x${string}`),
		staleTime: 1000 * 60 * 60 * 4, // 4 hours
	});
};
