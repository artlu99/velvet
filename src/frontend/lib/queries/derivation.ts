import type { Evolu } from "@evolu/common";
import { sqliteFalse, sqliteTrue } from "@evolu/common";
import type { KeyType } from "../schema";

/**
 * Query factory for getting derivation counter for a key type
 */
export const createDerivationCounterQuery = (evolu: Evolu, keyType: KeyType) =>
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
export const createAllDerivedKeysQuery = (evolu: Evolu) =>
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
	evolu: Evolu,
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
	evolu: Evolu,
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
 * @returns Result with inserted flag and EOA ID
 */
export async function insertDerivedKeyIfNew(
	evolu: Evolu,
	data: { index: number; address: string; encryptedPrivateKey: string },
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
		const isDeleted =
			existingRecord.isDeleted === 1 || existingRecord.isDeleted === sqliteTrue;

		if (isDeleted) {
			// Record is deleted - restore it by setting isDeleted to sqliteFalse
			// This allows users to "re-derive" deleted wallets and restore them
			evolu.update("eoa", {
				id: existingId,
				encryptedPrivateKey: data.encryptedPrivateKey,
				keyType: "evm",
				origin: "derived",
				derivationIndex: data.index,
				isDeleted: sqliteFalse, // Restore deleted wallet
				isSelected: existingRecord.isSelected ?? null,
			});

			// Return as inserted=true so UI shows success message and counter updates
			// This "loosens" the frontend guard to allow re-deriving deleted wallets
			return { inserted: true, eoaId: String(existingId) };
		}

		// Record exists and is not deleted - update it, return as not inserted
		evolu.update("eoa", {
			id: existingId,
			encryptedPrivateKey: data.encryptedPrivateKey,
			keyType: "evm",
			origin: "derived",
			derivationIndex: data.index,
			// Preserve isSelected if it exists, otherwise set to null
			isSelected: existingRecord.isSelected ?? null,
		});

		return { inserted: false, eoaId: String(existingId) };
	}

	// No existing record - insert new EOA with derivationIndex
	const result = evolu.insert("eoa", {
		address: data.address,
		encryptedPrivateKey: data.encryptedPrivateKey,
		keyType: "evm",
		origin: "derived",
		derivationIndex: data.index,
		isSelected: null,
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
export async function getAllDerivedKeys(evolu: Evolu): Promise<
	Array<{
		id: { readonly id: unknown };
		address: string;
		derivationIndex: number | null;
		origin: string | null;
	}>
> {
	const query = createAllDerivedKeysQuery(evolu);
	const rows = await evolu.loadQuery(query);
	return rows.map((row) => ({
		id: row.id,
		address: row.address,
		derivationIndex: row.derivationIndex,
		origin: row.origin,
	}));
}
