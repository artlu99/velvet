import { fetcher } from "itty-fetcher";
import type { GasEstimateRequest, GasEstimateResult } from "@shared/types";
import { useMutation } from "@tanstack/react-query";

const api = fetcher({ base: `${window.location.origin}/api` });

export const useEstimateGasMutation = () => {
	return useMutation({
		mutationKey: ["estimate-gas"],
		mutationFn: async (
			input: GasEstimateRequest,
		): Promise<GasEstimateResult> => {
			return api.post<GasEstimateRequest, GasEstimateResult>(
				"/estimate-gas",
				input,
			);
		},
	});
};

