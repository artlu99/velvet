import {
	createEvolu,
	createFormatTypeError,
	type MaxLengthError,
	type MinLengthError,
	SimpleName,
} from "@evolu/common";
import { createUseEvolu } from "@evolu/react";
import { evoluReactWebDeps } from "@evolu/react-web";
import { pluralize } from "./helpers";
import { Schema } from "./schema";

const EVOLU_INSTANCE = "underground-velvet-wallet-3241038978";

export const evoluInstance = createEvolu(evoluReactWebDeps)(Schema, {
	name: SimpleName.orThrow(EVOLU_INSTANCE),
	transports: [{ type: "WebSocket", url: "wss://evolu-relay-1.artlu.xyz" }],
});

/**
 * Typed React Hook for accessing Evolu instance.
 * Applications should use this instead of useEvolu() directly from @evolu/react.
 */
export const useEvolu = createUseEvolu(evoluInstance);

/**
 * Type for the Evolu instance.
 * Use this in function signatures that accept the Evolu instance.
 */
export type EvoluInstance = typeof evoluInstance;

/**
 * Format MinLengthError and MaxLengthError into human-readable messages.
 */
export const formatTypeError = createFormatTypeError<
	MinLengthError | MaxLengthError
>((error): string => {
	switch (error.type) {
		case "MinLength":
			return `Text must be at least ${pluralize(error.min, "character")} long`;
		case "MaxLength":
			return `Text is too long (maximum ${error.max} characters)`;
	}
});
