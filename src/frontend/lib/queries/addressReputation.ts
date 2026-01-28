/**
 * Address reputation queries and business logic
 *
 * Calculates address safety levels based on transaction history:
 * - Known addresses: Previously sent to or received from
 * - New addresses: Never interacted with
 * - Blocklisted addresses: Known scam/malicious addresses
 */

import { sqliteTrue } from "@evolu/common";
import { getAddress } from "viem";
import type { EvoluInstance } from "~/lib/evolu";
import type { EoaId } from "~/lib/schema";

export type AddressSafetyLevel = "known" | "new" | "blocklisted";

interface AddressReputation {
	address: string;
	safetyLevel: AddressSafetyLevel;
	interactionCount: number;
	lastInteraction: string | null;
	firstInteraction: string | null;
	totalSent: string;
	isReceivedFrom: boolean;
}

interface IncomingTransaction {
	from: string;
	value: string;
	timestamp: string;
}

/**
 * Query to get all sent transactions for a wallet
 * Used to build address reputation
 */
export const createSentTransactionsQuery = (
	evolu: EvoluInstance,
	walletId: EoaId,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("transaction")
			.selectAll()
			.where("walletId", "=", walletId)
			.where("to", "is not", null)
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("createdAt", "desc"),
	);

/**
 * Query factory for getting transactions to a specific address
 */
export const createTransactionsToAddressQuery = (
	evolu: EvoluInstance,
	walletId: EoaId,
	address: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("transaction")
			.selectAll()
			.where("walletId", "=", walletId)
			.where("to", "=", getAddress(address) as never)
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("createdAt", "desc"),
	);

/**
 * Get reputation for a specific address
 *
 * @param evolu - Evolu instance
 * @param walletId - Current wallet ID
 * @param address - Address to check
 * @param incomingTxs - Optional incoming transaction history
 * @returns Address reputation data
 */
export async function getAddressReputation(
	evolu: EvoluInstance,
	walletId: EoaId,
	address: string | null,
	incomingTxs?: Array<IncomingTransaction>,
): Promise<AddressReputation | null> {
	if (!address) {
		return null;
	}
	// Check sent transactions using loadQuery
	const sentTxsQuery = createTransactionsToAddressQuery(
		evolu,
		walletId,
		address,
	);
	const sentTxs = await evolu.loadQuery(sentTxsQuery);

	const sentCount = sentTxs.length;

	// Sum total sent (BigInt for precision)
	const totalSent = sentTxs
		.reduce(
			(sum: bigint, tx) =>
				sum + BigInt((tx as { value: string | null }).value ?? "0"),
			0n,
		)
		.toString();

	// Check received transactions (if provided)
	let receivedCount = 0;
	if (incomingTxs) {
		const received = incomingTxs.filter(
			(tx) => getAddress(tx.from) === getAddress(address),
		);
		receivedCount = received.length;
	}

	const totalInteractions = sentCount + receivedCount;

	// Determine safety level (blocklist check happens separately in React Query)
	const safetyLevel: AddressSafetyLevel =
		totalInteractions > 0 ? "known" : "new";

	return {
		address,
		safetyLevel,
		interactionCount: totalInteractions,
		lastInteraction:
			(sentTxs[0] as { createdAt: string | null } | undefined)?.createdAt ??
			null,
		firstInteraction:
			(sentTxs[sentTxs.length - 1] as { createdAt: string | null } | undefined)
				?.createdAt ?? null,
		totalSent,
		isReceivedFrom: receivedCount > 0,
	};
}
