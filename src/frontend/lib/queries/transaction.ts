import { sqliteTrue } from "@evolu/common";
import type { EvoluInstance } from "../evolu";
import type { EoaId, TransactionId } from "../schema";

/**
 * Query for all transactions for a specific wallet.
 */
export const createTransactionsByWalletQuery = (
	evolu: EvoluInstance,
	walletId: EoaId,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("transaction")
			.selectAll()
			.where("walletId", "=", walletId)
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("createdAt", "desc"),
	);

/**
 * Query for a specific transaction by ID.
 */
export const createTransactionByIdQuery = (
	evolu: EvoluInstance,
	transactionId: TransactionId,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("transaction")
			.selectAll()
			.where("id", "=", transactionId)
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Query for pending transactions (for status updates).
 */
export const createPendingTransactionsQuery = (evolu: EvoluInstance) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("transaction")
			.selectAll()
			.where("status", "=", "pending")
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("createdAt", "asc"),
	);

/**
 * Query for a transaction by hash.
 */
export const createTransactionByHashQuery = (
	evolu: EvoluInstance,
	txHash: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("transaction")
			.selectAll()
			.where("txHash", "=", txHash as never)
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);
