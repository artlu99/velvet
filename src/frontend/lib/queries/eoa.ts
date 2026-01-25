import type { Evolu } from "@evolu/common";
import { sqliteTrue } from "@evolu/common";
import { getAddress, isAddress } from "viem";
import type { EoaId } from "../schema";

/**
 * Normalizes an EVM address to checksummed format.
 * For non-EVM addresses (e.g., Tron), returns as-is.
 * @param address - The address to normalize
 * @returns Normalized address (checksummed for EVM, unchanged for others)
 */
export function normalizeAddressForQuery(address: string): string {
	// Only normalize EVM addresses (0x-prefixed)
	if (address.startsWith("0x") && isAddress(address)) {
		return getAddress(address);
	}
	return address;
}

export const createAllEoasQuery = (evolu: Evolu) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("createdAt", "desc"),
	);

/**
 * Query for getting the currently selected wallet.
 * Returns the wallet with isSelected=1, or null if none selected.
 */
export const createSelectedEoaQuery = (evolu: Evolu) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue)
			.where("isSelected", "is", sqliteTrue)
			.limit(1),
	);

/**
 * Query for getting a specific wallet by ID.
 */
export const createEoaByIdQuery = (evolu: Evolu, id: EoaId) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue)
			.where("id", "=", id)
			.limit(1),
	);

/**
 * Query for getting a specific wallet by address.
 * Address is treated as unique (enforced by duplicate check on insert).
 */
export const createEoaByAddressQuery = (evolu: Evolu, address: string) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue)
			.where("address", "=", address)
			.limit(1),
	);

/**
 * Query for getting a wallet by address without filtering by isDeleted.
 * Used for update-or-insert operations to find existing records even if deleted.
 */
export const createEoaByAddressAnyQuery = (evolu: Evolu, address: string) =>
	evolu.createQuery((db) =>
		db.selectFrom("eoa").selectAll().where("address", "=", address).limit(1),
	);

/**
 * Result type for findEoaByAddressCaseInsensitive
 */
export type ExistingEoaRecord = {
	id: EoaId;
	address: string;
	origin: string | null;
	encryptedPrivateKey: string | null;
	isSelected: unknown; // SqliteBoolean from Evolu
	isDeleted: unknown; // SqliteBoolean from Evolu - check with sqliteTrue
	keyType: string | null;
	derivationIndex: number | null;
};

/**
 * Finds an existing EOA by address with case-insensitive matching for EVM addresses.
 * Checks for both checksummed and lowercase versions to handle legacy data.
 * Includes deleted records (for restore operations).
 *
 * @param evolu - Evolu instance
 * @param address - Address to search for (will be normalized)
 * @returns Promise resolving to the existing record or null
 */
export async function findEoaByAddressCaseInsensitive(
	evolu: Evolu,
	address: string,
): Promise<ExistingEoaRecord | null> {
	const normalizedAddress = normalizeAddressForQuery(address);

	// First, try to find by normalized (checksummed) address
	const normalizedQuery = createEoaByAddressAnyQuery(evolu, normalizedAddress);
	const normalizedResult = await evolu.loadQuery(normalizedQuery);

	if (normalizedResult.length > 0) {
		const row = normalizedResult[0];
		return {
			id: row.id,
			address: row.address,
			origin: row.origin,
			encryptedPrivateKey: row.encryptedPrivateKey,
			isSelected: row.isSelected,
			isDeleted: row.isDeleted,
			keyType: row.keyType,
			derivationIndex: row.derivationIndex,
		};
	}

	// For EVM addresses, also check lowercase version (legacy data compatibility)
	if (normalizedAddress.startsWith("0x")) {
		const lowercaseAddress = normalizedAddress.toLowerCase();
		if (lowercaseAddress !== normalizedAddress) {
			const lowercaseQuery = createEoaByAddressAnyQuery(
				evolu,
				lowercaseAddress,
			);
			const lowercaseResult = await evolu.loadQuery(lowercaseQuery);

			if (lowercaseResult.length > 0) {
				const row = lowercaseResult[0];
				return {
					id: row.id,
					address: row.address,
					origin: row.origin,
					encryptedPrivateKey: row.encryptedPrivateKey,
					isSelected: row.isSelected,
					isDeleted: row.isDeleted,
					keyType: row.keyType,
					derivationIndex: row.derivationIndex,
				};
			}
		}
	}

	return null;
}
