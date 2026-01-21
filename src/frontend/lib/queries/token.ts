import type { Evolu } from "@evolu/common";
import type { EoaId } from "../schema";

/**
 * Query for getting token balances for a specific EOA.
 * Token metadata (symbol, name, decimals) should be fetched from the Zustand store
 * and matched by tokenAddress + chainId.
 */
export const createTokenBalancesQuery = (evolu: Evolu, eoaId: EoaId) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("tokenBalance")
			.selectAll()
			.where("tokenBalance.eoaId", "=", eoaId)
			.where("tokenBalance.isDeleted", "is", null),
	);
