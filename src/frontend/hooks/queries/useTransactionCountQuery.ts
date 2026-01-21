import type { ApiResponses } from "@shared/api";
import type { SupportedChainId } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

interface UseTransactionCountQueryOptions {
	address: string;
	chainId: SupportedChainId;
	enabled?: boolean;
}

export const useTransactionCountQuery = ({
	address,
	chainId,
	enabled = true,
}: UseTransactionCountQueryOptions) => {
	return useQuery({
		queryKey: ["transaction-count", address, chainId],
		queryFn: async () =>
			api.get<ApiResponses["transactionCount"]>(
				`/transaction-count/${address}?chainId=${chainId}`,
			),
		enabled: enabled && Boolean(address),
		staleTime: 0,
	});
};

