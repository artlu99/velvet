import type { Evolu } from "@evolu/common";
import { sqliteTrue } from "@evolu/common";
import type { EoaId } from "../schema";

export const createAllEoasQuery = (evolu: Evolu) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.selectAll()
			.where("isDeleted", "is", null)
			.orderBy("createdAt", "desc"),
	);

export const createEoaDuplicateCheckQuery = (
	evolu: Evolu,
	address: string,
	unencryptedPrivateKey: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("eoa")
			.select(["address", "unencryptedPrivateKey"])
			.where("isDeleted", "is", null)
			.where((eb) =>
				eb.or([
					eb("address", "=", address),
					eb("unencryptedPrivateKey", "=", unencryptedPrivateKey),
				]),
			),
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
			.where("isDeleted", "is", null)
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
			.where("isDeleted", "is", null)
			.where("id", "=", id)
			.limit(1),
	);
