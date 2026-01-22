import type { Evolu } from "@evolu/common";
import { sqliteTrue } from "@evolu/common";
import type { EoaId } from "../schema";

export const createAllEoasQuery = (evolu: Evolu) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("createdAt", "desc"),
	);

export const createEoaDuplicateCheckQuery = (evolu: Evolu, address: string) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.select(["address", "origin"])
			.where("isDeleted", "is not", sqliteTrue)
			.where("address", "=", address),
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
