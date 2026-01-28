/**
 * React Query hook for transaction receipt
 *
 * Fetches transaction receipt from blockchain with polling for pending transactions
 */

import type { SupportedChainId, TransactionReceiptResult } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

interface UseTransactionReceiptQueryOptions {
	txHash: string;
	chainId: SupportedChainId;
	enabled?: boolean;
	isPending?: boolean; // Whether transaction is still pending
}

export const useTransactionReceiptQuery = ({
	txHash,
	chainId,
	enabled = true,
	isPending = false,
}: UseTransactionReceiptQueryOptions) => {
	const api = fetcher({
		base: `${window.location.origin}/api`,
	});

	return useQuery<TransactionReceiptResult>({
		queryKey: ["transactionReceipt", txHash, chainId],
		queryFn: () =>
			api.get(
				`/transaction/${txHash}?chainId=${chainId}`,
			) as Promise<TransactionReceiptResult>,
		enabled: enabled && !!txHash && chainId !== "tron", // Not supported for Tron
		staleTime: 30 * 1000, // 30 seconds
		retry: 3, // Retry up to 3 times for pending transactions
		// Poll every 30 seconds if transaction is pending
		// Stop polling once transaction is confirmed (receiptData.ok === true)
		refetchInterval: (query) => {
			if (!isPending) return false;
			const data = query.state.data;
			// Stop polling if we got a receipt (confirmed or failed)
			if (data?.ok === true) return false;
			// Continue polling if still pending
			return 30 * 1000; // 30 seconds
		},
	});
};
