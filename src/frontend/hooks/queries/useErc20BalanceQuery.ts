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
}

export const useErc20BalanceQuery = ({
	address,
	contract,
	chainId,
	enabled = true,
}: UseErc20BalanceQueryOptions) => {
	return useQuery({
		queryKey: ["erc20Balance", address, contract, chainId],
		queryFn: async () => {
			const url = buildUrl(apiEndpoints.erc20Balance.path, {
				address,
				contract,
				query: { chainId: String(chainId) },
			});
			return api.get<ApiResponses["erc20Balance"]>(url);
		},
		enabled: enabled && Boolean(address) && Boolean(contract),
	});
};
