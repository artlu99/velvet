import type { Evolu } from "@evolu/common";

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

