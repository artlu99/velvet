import type { TronBroadcastRequest, TronBroadcastResult } from "@shared/types";
import { useMutation } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

export const useBroadcastTronTransactionMutation = () => {
	return useMutation({
		mutationKey: ["broadcast-transaction", "tron"],
		mutationFn: async (
			input: TronBroadcastRequest,
		): Promise<TronBroadcastResult> => {
			return api.post<TronBroadcastRequest, TronBroadcastResult>(
				"/broadcast-transaction/tron",
				input,
			);
		},
	});
};
