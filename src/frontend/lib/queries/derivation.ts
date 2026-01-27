import { sqliteFalse, sqliteTrue } from "@evolu/common";
import type { EvoluInstance } from "../evolu";
import type { EoaId, KeyType } from "../schema";
import { getNextOrderIndex } from "./walletOrdering";

/**
 * Query factory for getting derivation counter for a key type
 */
export const createDerivationCounterQuery = (
	evolu: EvoluInstance,
	keyType: KeyType,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("derivationCounter")
			.selectAll()
			.where("keyType", "=", keyType)
			.limit(1),
	);

/**
 * Query factory for getting all derived keys
 */
export const createAllDerivedKeysQuery = (evolu: EvoluInstance) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("origin", "=", "derived")
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("createdAt", "desc"),
	);

/**
 * Gets the next derivation index (read-only)
 * Returns the value from the counter, or initializes if needed
 * @param evolu - Evolu instance
 * @param keyType - Type of key ("evm" | "tron" | "btc" | "solana")
 * @returns Next index to use
 */
export async function getNextSuggestedIndex(
	evolu: EvoluInstance,
	keyType: KeyType,
): Promise<number> {
	// Get existing counter
	const counterQuery = createDerivationCounterQuery(evolu, keyType);
	const counters = await evolu.loadQuery(counterQuery);
	return counters[0]?.nextIndex ?? 0;
}

/**
 * Initializes or updates the derivation counter after successful key derivation
 * @param evolu - Evolu instance
 * @param keyType - Type of key ("evm" | "tron" | "btc" | "solana")
 * @param derivedIndex - The index that was just derived
 */
export async function updateDerivationCounter(
	evolu: EvoluInstance,
	keyType: KeyType,
	derivedIndex: number,
): Promise<void> {
	// Get existing counter
	const counterQuery = createDerivationCounterQuery(evolu, keyType);
	const counters = await evolu.loadQuery(counterQuery);
	evolu.update("derivationCounter", {
		id: counters[0]?.id ?? 0,
		nextIndex: derivedIndex + 1,
	});
}

/**
 * Inserts or updates a derived key (update-or-insert pattern).
 * If a record with the same address exists (even if deleted), it will be updated.
 * Otherwise, a new record will be inserted.
 *
 * This prevents duplicates when deriving the same index multiple times,
 * even if the previous record was deleted or has a different row.id.
 *
 * @param evolu - Evolu instance
 * @param data - Key data to insert/update
 * @param keyType - Type of key ("evm" | "tron" | "btc" | "solana")
 * @returns Result with inserted flag and EOA ID
 */
export async function insertDerivedKeyIfNew(
	evolu: EvoluInstance,
	data: { index: number; address: string; encryptedPrivateKey: string },
	keyType: KeyType = "evm",
): Promise<{ inserted: boolean; eoaId: string | null }> {
	// Check for ANY existing record with this address (including deleted ones)
	// Import dynamically to avoid circular dependency
	const { createEoaByAddressAnyQuery } = await import("./eoa");
	const addressQuery = createEoaByAddressAnyQuery(evolu, data.address);
	const existing = await evolu.loadQuery(addressQuery);

	if (existing.length > 0) {
		// Record exists - check if it's deleted
		const existingRecord = existing[0];
		const existingId = existingRecord.id;
		const isDeleted = existingRecord.isDeleted === sqliteTrue;

		if (isDeleted) {
			// Record is deleted - restore it by setting isDeleted to sqliteFalse
			// This allows users to "re-derive" deleted wallets and restore them
			const nextOrderIndex = await getNextOrderIndex(evolu);
			evolu.update("eoa", {
				id: existingId,
				encryptedPrivateKey: data.encryptedPrivateKey,
				keyType,
				origin: "derived",
				derivationIndex: data.index,
				isDeleted: sqliteFalse, // Restore deleted wallet
				isSelected: existingRecord.isSelected ?? null,
				orderIndex: nextOrderIndex,
			});

			// Return as inserted=true so UI shows success message and counter updates
			// This "loosens" the frontend guard to allow re-deriving deleted wallets
			return { inserted: true, eoaId: String(existingId) };
		}

		// Record exists and is not deleted - update it, return as not inserted
		const nextOrderIndex = await getNextOrderIndex(evolu);
		evolu.update("eoa", {
			id: existingId,
			encryptedPrivateKey: data.encryptedPrivateKey,
			keyType,
			origin: "derived",
			derivationIndex: data.index,
			// Preserve isSelected if it exists, otherwise set to null
			isSelected: existingRecord.isSelected ?? null,
			orderIndex: nextOrderIndex,
		});

		return { inserted: false, eoaId: String(existingId) };
	}

	// No existing record - insert new EOA with derivationIndex
	const nextOrderIndex = await getNextOrderIndex(evolu);
	const result = evolu.insert("eoa", {
		address: data.address,
		encryptedPrivateKey: data.encryptedPrivateKey,
		keyType,
		origin: "derived",
		derivationIndex: data.index,
		isSelected: null,
		orderIndex: nextOrderIndex,
	});

	if (!result.ok) {
		throw new Error(
			`Failed to insert derived key: ${JSON.stringify(result.error)}`,
		);
	}

	return { inserted: true, eoaId: String(result.value) };
}

/**
 * Helper to get all derived keys
 * @param evolu - Evolu instance
 * @returns Array of derived keys
 */
/**
 * Narrowed type for derived key data (address is guaranteed to be non-null)
 */
interface DerivedKeyData {
	id: EoaId;
	address: string;
	derivationIndex: number | null;
	origin: string | null;
}

export async function getAllDerivedKeys(
	evolu: EvoluInstance,
): Promise<DerivedKeyData[]> {
	const query = createAllDerivedKeysQuery(evolu);
	const rows = await evolu.loadQuery(query);
	return rows
		.filter((row) => {
			const address =
				row.address && typeof row.address === "string" ? row.address : null;
			return address !== null;
		})
		.map((row): DerivedKeyData => {
			const address =
				row.address && typeof row.address === "string" ? row.address : "";
			return {
				id: row.id,
				address,
				derivationIndex:
					typeof row.derivationIndex === "number" ? row.derivationIndex : null,
				origin:
					row.origin && typeof row.origin === "string" ? row.origin : null,
			};
		});
}
