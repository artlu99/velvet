import { sqliteTrue } from "@evolu/common";
import { getAddress, isAddress } from "viem";
import type { EvoluInstance } from "../evolu";
import { evoluInstance } from "../evolu";
import type { EoaId } from "../schema";
import { asNonEmptyString1000 } from "./brandedTypes";

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

/**
 * Query for all non-deleted EOAs.
 * Sorting is done in JavaScript to avoid SQLite null handling issues with orderIndex.
 * Created once at module level per Evolu best practices.
 */
export const allEoasQuery = evoluInstance.createQuery((db) =>
	db.selectFrom("eoa").selectAll().where("isDeleted", "is not", sqliteTrue),
);

// @deprecated Use allEoasQuery directly instead
export const createAllEoasQuery = (_evolu: EvoluInstance) => allEoasQuery;

/**
 * Query for getting the currently selected wallet.
 * Returns the wallet with isSelected=1, or null if none selected.
 */
export const createSelectedEoaQuery = (evolu: EvoluInstance) =>
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
export const createEoaByIdQuery = (evolu: EvoluInstance, id: EoaId) =>
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
export const createEoaByAddressQuery = (
	evolu: EvoluInstance,
	address: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue)
			.where("address", "=", asNonEmptyString1000(address))
			.limit(1),
	);

/**
 * Query for getting a wallet by address without filtering by isDeleted.
 * Used for update-or-insert operations to find existing records even if deleted.
 */
export const createEoaByAddressAnyQuery = (
	evolu: EvoluInstance,
	address: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("address", "=", asNonEmptyString1000(address))
			.limit(1),
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
	orderIndex: number | null;
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
	evolu: EvoluInstance,
	address: string,
): Promise<ExistingEoaRecord | null> {
	const normalizedAddress = normalizeAddressForQuery(address);

	// First, try to find by normalized (checksummed) address
	const normalizedQuery = createEoaByAddressAnyQuery(evolu, normalizedAddress);
	const normalizedResult = await evolu.loadQuery(normalizedQuery);

	if (normalizedResult.length > 0) {
		const row = normalizedResult[0];
		const address =
			row.address && typeof row.address === "string" ? row.address : null;
		if (!address) {
			return null;
		}
		const narrowed: ExistingEoaRecord = {
			id: row.id,
			address,
			origin: row.origin && typeof row.origin === "string" ? row.origin : null,
			encryptedPrivateKey:
				row.encryptedPrivateKey && typeof row.encryptedPrivateKey === "string"
					? row.encryptedPrivateKey
					: null,
			isSelected: row.isSelected,
			isDeleted: row.isDeleted,
			keyType:
				row.keyType && typeof row.keyType === "string" ? row.keyType : null,
			derivationIndex:
				typeof row.derivationIndex === "number" ? row.derivationIndex : null,
			orderIndex: typeof row.orderIndex === "number" ? row.orderIndex : null,
		};
		return narrowed;
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
				const address =
					row.address && typeof row.address === "string" ? row.address : null;
				if (!address) {
					return null;
				}
				const narrowed: ExistingEoaRecord = {
					id: row.id,
					address,
					origin:
						row.origin && typeof row.origin === "string" ? row.origin : null,
					encryptedPrivateKey:
						row.encryptedPrivateKey &&
						typeof row.encryptedPrivateKey === "string"
							? row.encryptedPrivateKey
							: null,
					isSelected: row.isSelected,
					isDeleted: row.isDeleted,
					keyType:
						row.keyType && typeof row.keyType === "string" ? row.keyType : null,
					derivationIndex:
						typeof row.derivationIndex === "number"
							? row.derivationIndex
							: null,
					orderIndex:
						typeof row.orderIndex === "number" ? row.orderIndex : null,
				};
				return narrowed;
			}
		}
	}

	return null;
}
