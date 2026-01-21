import { useEvolu, useQuery as useEvoluQuery } from "@evolu/react";
import type { SupportedChainId } from "@shared/types";
import { createTokenBalancesQuery } from "~/lib/queries/token";
import type { EoaId } from "~/lib/schema";
import { useTokenStore } from "~/providers/tokenStore";

/**
 * Hook to get tokens from Zustand store.
 * @param chainId - Optional chain ID to filter tokens
 */
export const useTokensQuery = (chainId?: SupportedChainId) => {
	const getTokensByChain = useTokenStore((state) => state.getTokensByChain);
	const tokens = useTokenStore((state) => state.tokens);

	if (chainId) {
		return { data: { ok: true, tokens: getTokensByChain(chainId) } };
	}

	return { data: { ok: true, tokens: Object.values(tokens) } };
};

/**
 * Hook to get a specific token by contract address and chain ID.
 */
export const useTokenByAddress = (
	address: string,
	chainId: SupportedChainId,
) => {
	const getTokenByAddress = useTokenStore((state) => state.getTokenByAddress);
	return getTokenByAddress(address, chainId);
};

/**
 * Hook to get token balances for a specific EOA from local database.
 */
export const useTokenBalances = (eoaId: EoaId) => {
	const evolu = useEvolu();
	const query = createTokenBalancesQuery(evolu, eoaId);
	return useEvoluQuery(query);
};
