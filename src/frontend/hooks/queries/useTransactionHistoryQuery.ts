/**
 * React Query hook for transaction history
 *
 * Fetches incoming transaction history with smart dust filtering
 */

import type { SupportedChainId } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

export interface TransactionHistoryTx {
	hash: string;
	from: string;
	to: string | null;
	value: string;
	gasUsed: string;
	gasPrice: string;
	methodId: string;
	timeStamp: string;
	estimatedUsdValue: number;
}

interface TransactionHistoryResult {
	ok: true;
	data: Array<TransactionHistoryTx>;
	timestamp: number;
}

interface UseTransactionHistoryQueryOptions {
	address: string;
	chainId: SupportedChainId;
	enabled?: boolean;
}

export const useTransactionHistoryQuery = ({
	address,
	chainId,
	enabled = true,
}: UseTransactionHistoryQueryOptions) => {
	const api = fetcher({
		base: `${window.location.origin}/api`,
	});

	return useQuery<TransactionHistoryResult>({
		queryKey: ["transactionHistory", address, chainId],
		queryFn: () =>
			api.get(
				`/transactions/${address}?chainId=${chainId}`,
			) as Promise<TransactionHistoryResult>,
		enabled: enabled && !!address && chainId !== "tron", // Not supported for Tron
		staleTime: 2 * 60 * 1000, // 2 minutes
		refetchInterval: 5 * 60 * 1000, // Refetch every 5 min
	});
};
