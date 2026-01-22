import type { Evolu } from "@evolu/common";
import { sqliteTrue } from "@evolu/common";
import type { EoaId, TransactionId } from "../schema";

/**
 * Query for all transactions for a specific wallet.
 */
export const createTransactionsByWalletQuery = (
	evolu: Evolu,
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
	evolu: Evolu,
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
export const createPendingTransactionsQuery = (evolu: Evolu) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("transaction")
			.selectAll()
			.where("status", "=", "pending")
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("createdAt", "asc"),
	);
