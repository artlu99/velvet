import { createStore, del, get, set } from "idb-keyval";

export function createIDBPersister(idbValidKey: IDBValidKey = "reactQuery") {
	// Create a store with a custom database and store name
	const store = createStore("tanstack-query-db", "tanstack-query-store");

	return {
		persistClient: async (client: unknown) => {
			await set(idbValidKey, client, store);
		},
		restoreClient: async () => {
			return await get(idbValidKey, store);
		},
		removeClient: async () => {
			await del(idbValidKey, store);
		},
	};
}
