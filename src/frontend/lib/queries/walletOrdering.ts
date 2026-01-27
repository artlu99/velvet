import type { EoaRow } from "~/lib/eoaValidation";
import type { EvoluInstance } from "~/lib/evolu";
import { createAllEoasQuery } from "./eoa";

/**
 * Migrates existing wallets by assigning orderIndex values.
 * Called once on app load if any wallets have null orderIndex.
 */
export async function migrateWalletOrdering(
	evolu: EvoluInstance,
): Promise<void> {
	const allEoas = createAllEoasQuery(evolu);
	const rows = await evolu.loadQuery(allEoas);

	// Find wallets without orderIndex
	const needsMigration = rows.filter((row) => row.orderIndex === null);
	if (needsMigration.length === 0) return;

	// Find max orderIndex across all wallets
	const maxOrderIndex = rows.reduce(
		(max, row) =>
			row.orderIndex !== null ? Math.max(max, row.orderIndex) : max,
		-1,
	);

	// Assign sequential orderIndex values (preserves createdAt order)
	const updates = needsMigration.map((row, index) => ({
		id: row.id,
		orderIndex: maxOrderIndex + index + 1,
	}));

	for (const update of updates) {
		evolu.update("eoa", update);
	}
}

/**
 * Gets the next orderIndex for a new wallet.
 */
export async function getNextOrderIndex(evolu: EvoluInstance): Promise<number> {
	const allEoas = createAllEoasQuery(evolu);
	const rows = await evolu.loadQuery(allEoas);

	const maxOrderIndex = rows.reduce(
		(max, row) =>
			row.orderIndex !== null ? Math.max(max, row.orderIndex) : max,
		-1,
	);

	return maxOrderIndex + 1;
}

/**
 * Reorders wallets after drag-and-drop by updating orderIndex values.
 * Uses sequential reindexing (0, 1, 2, ...) to ensure no gaps.
 *
 * @param evolu - Evolu instance
 * @param wallets - Array of all wallets in current sorted order
 * @param oldIndex - Original index of dragged wallet
 * @param newIndex - New index where wallet was dropped
 */
export async function reorderWallets(
	evolu: EvoluInstance,
	wallets: readonly EoaRow[],
	oldIndex: number,
	newIndex: number,
): Promise<void> {
	// Edge case: same position
	if (oldIndex === newIndex) {
		return;
	}

	// Edge case: invalid indices
	if (
		oldIndex < 0 ||
		oldIndex >= wallets.length ||
		newIndex < 0 ||
		newIndex >= wallets.length
	) {
		throw new Error(
			`Invalid indices: oldIndex=${oldIndex}, newIndex=${newIndex}, wallets.length=${wallets.length}`,
		);
	}

	// 1. Create mutable copy and reorder array
	const reordered = [...wallets];
	const [moved] = reordered.splice(oldIndex, 1);
	reordered.splice(newIndex, 0, moved);

	// 2. Reassign orderIndex sequentially (0, 1, 2, ...)
	// This ensures no gaps in the sequence
	for (let i = 0; i < reordered.length; i++) {
		evolu.update("eoa", {
			id: reordered[i].id,
			orderIndex: i,
		});
	}
}
