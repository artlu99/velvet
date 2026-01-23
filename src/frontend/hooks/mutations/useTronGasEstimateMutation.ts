import type {
	TronGasEstimateRequest,
	TronGasEstimateResult,
} from "@shared/types";
import { useMutation } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

export const useTronGasEstimateMutation = () => {
	return useMutation({
		mutationKey: ["estimate-gas", "tron"],
		mutationFn: async (
			input: TronGasEstimateRequest,
		): Promise<TronGasEstimateResult> => {
			return api.post<TronGasEstimateRequest, TronGasEstimateResult>(
				"/estimate-gas/tron",
				input,
			);
		},
	});
};
