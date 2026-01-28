/**
 * Address Safety Badge Component
 *
 * Displays visual indicator of address safety level:
 * - Known (green): Previously interacted with
 * - New (yellow): Never interacted with
 * - Blocklisted (red): Known scam/malicious address
 */

import type { FC } from "react";
import type { AddressSafetyLevel } from "~/lib/queries/addressReputation";

interface BadgeProps {
	safetyLevel: AddressSafetyLevel;
	interactionCount?: number;
	blocklistReason?: string | null;
}

export const AddressSafetyBadge: FC<BadgeProps> = ({
	safetyLevel,
	interactionCount,
	blocklistReason,
}) => {
	const config = {
		known: {
			color: "text-success",
			bgColor: "bg-success/10",
			icon: "fa-solid fa-check-circle",
			label: "Known address",
		},
		new: {
			color: "text-warning",
			bgColor: "bg-warning/10",
			icon: "fa-solid fa-circle-exclamation",
			label: "New address",
		},
		blocklisted: {
			color: "text-error",
			bgColor: "bg-error/10",
			icon: "fa-solid fa-triangle-exclamation",
			label: "Blocklisted",
		},
	}[safetyLevel];

	return (
		<div
			className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor}`}
		>
			<i className={`${config.icon} ${config.color}`} />
			<span className={`text-sm font-medium ${config.color}`}>
				{config.label}
			</span>
			{safetyLevel === "known" && interactionCount && interactionCount > 0 && (
				<span className="text-xs opacity-70">
					({interactionCount}{" "}
					{interactionCount === 1 ? "transaction" : "transactions"})
				</span>
			)}
			{safetyLevel === "blocklisted" && blocklistReason && (
				<span className="text-xs opacity-70">- {blocklistReason}</span>
			)}
		</div>
	);
};
