/**
 * Blocklist queries and operations
 *
 * Manages app-provided and user-customized address blocklists
 */

import { sqliteTrue } from "@evolu/common";
import { getAddress } from "viem";
import type { EvoluInstance } from "~/lib/evolu";
import type { BlocklistId } from "~/lib/schema";

/**
 * Query factory for checking if an address is blocklisted
 */
export const createBlocklistByAddressQuery = (
	evolu: EvoluInstance,
	address: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("blocklist")
			.selectAll()
			.where("address", "=", getAddress(address) as never)
			.where("isDeleted", "is not", sqliteTrue),
	);

/**
 * Query factory for getting all active blocklist entries
 */
export const createActiveBlocklistQuery = (evolu: EvoluInstance) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("blocklist")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue)
			.orderBy("addedAt", "desc"),
	);

/**
 * Check if an address is blocklisted
 */
export async function isAddressBlocklisted(
	evolu: EvoluInstance,
	address: string,
): Promise<boolean> {
	const query = createBlocklistByAddressQuery(evolu, address);
	const results = await evolu.loadQuery(query);
	return results.length > 0;
}

/**
 * Get blocklist reason for an address
 */
export async function getBlocklistReason(
	evolu: EvoluInstance,
	address: string,
): Promise<string | null> {
	const query = createBlocklistByAddressQuery(evolu, address);
	const results = await evolu.loadQuery(query);
	return results.length > 0
		? (results[0] as { reason: string | null }).reason
		: null;
}

/**
 * Add address to blocklist
 */
export async function addToBlocklist(
	evolu: EvoluInstance,
	address: string,
	reason?: string,
): Promise<void> {
	await evolu.insert("blocklist", {
		address: getAddress(address),
		reason: reason ?? "User-blocked",
		source: "user",
		addedAt: new Date().toISOString(),
	});
}

/**
 * Remove address from blocklist (soft delete)
 */
export async function removeFromBlocklist(
	evolu: EvoluInstance,
	id: BlocklistId,
): Promise<void> {
	await evolu.update("blocklist", {
		id,
		isDeleted: sqliteTrue,
	});
}

/**
 * Get all active blocklist entries
 */
export async function getActiveBlocklist(evolu: EvoluInstance): Promise<
	Array<{
		id: BlocklistId;
		address: string;
		reason: string | null;
		source: "app" | "user";
		addedAt: string;
	}>
> {
	const query = createActiveBlocklistQuery(evolu);
	const results = await evolu.loadQuery(query);
	return results as unknown as Array<{
		id: BlocklistId;
		address: string;
		reason: string | null;
		source: "app" | "user";
		addedAt: string;
	}>;
}
