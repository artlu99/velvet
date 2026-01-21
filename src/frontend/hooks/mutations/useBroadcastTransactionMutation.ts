import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

import type {
	BroadcastTransactionRequest,
	BroadcastTransactionResult,
} from "@shared/types";
import { useMutation } from "@tanstack/react-query";

export const useBroadcastTransactionMutation = () => {
	return useMutation({
		mutationKey: ["broadcast-transaction"],
		mutationFn: async (
			input: BroadcastTransactionRequest,
		): Promise<BroadcastTransactionResult> => {
			return api.post<BroadcastTransactionRequest, BroadcastTransactionResult>("/broadcast-transaction", input);
		},
	});
};
