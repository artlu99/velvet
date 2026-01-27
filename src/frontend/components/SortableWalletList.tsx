import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { FC } from "react";
import type { EoaRow } from "~/lib/eoaValidation";
import { SortableWalletCard } from "./SortableWalletCard";

interface SortableWalletListProps {
	readonly wallets: readonly EoaRow[];
	readonly onReorder: (oldIndex: number, newIndex: number) => void;
	readonly onDelete: (row: EoaRow) => void;
	readonly onCopyAddress: (address: string) => void;
	readonly copiedText: string | null;
}

/**
 * Wrapper component that enables drag-and-drop for desktop wallet list.
 * Uses @dnd-kit for sortable functionality.
 */
export const SortableWalletList: FC<SortableWalletListProps> = ({
	wallets,
	onReorder,
	onDelete,
	onCopyAddress,
	copiedText,
}) => {
	// Extract wallet IDs for SortableContext
	const walletIds = wallets.map((wallet) => wallet.id);

	// Handle drag end event
	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		// Only reorder if dropped on a different wallet
		if (over && active.id !== over.id) {
			const oldIndex = wallets.findIndex((w) => w.id === active.id);
			const newIndex = wallets.findIndex((w) => w.id === over.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				onReorder(oldIndex, newIndex);
			}
		}
	};

	return (
		<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext items={walletIds} strategy={verticalListSortingStrategy}>
				<div className="space-y-4">
					{wallets.map((row) => (
						<SortableWalletCard
							key={row.id}
							id={row.id}
							row={row}
							onDelete={onDelete}
							onCopyAddress={onCopyAddress}
							copiedText={copiedText}
						/>
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
};
