import type {
	Erc20GasEstimateRequest,
	Erc20GasEstimateResult,
} from "@shared/types";
import { useMutation } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({
	base: `${window.location.origin}/api`,
	headers: {
		Origin: window.location.origin,
	},
});

export const useEstimateErc20GasMutation = () => {
	return useMutation({
		mutationKey: ["estimate-gas", "erc20"],
		mutationFn: async (
			input: Erc20GasEstimateRequest,
		): Promise<Erc20GasEstimateResult> => {
			return api.post<Erc20GasEstimateRequest, Erc20GasEstimateResult>(
				"/estimate-gas/erc20",
				input,
			);
		},
	});
};
