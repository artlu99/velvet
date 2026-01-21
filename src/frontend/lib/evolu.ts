import {
	createEvolu,
	createFormatTypeError,
	type MaxLengthError,
	type MinLengthError,
	SimpleName,
} from "@evolu/common";
import { evoluReactWebDeps } from "@evolu/react-web";
import { Schema } from "./schema";

const EVOLU_INSTANCE = "underground-velvet-wallet-3241038977";

export const evoluInstance = createEvolu(evoluReactWebDeps)(Schema, {
	name: SimpleName.orThrow(EVOLU_INSTANCE),
	transports: [
		{ type: "WebSocket", url: "wss://evolu-relay-1.artlu.xyz" },
		{ type: "WebSocket", url: "wss://evolu-relay-2.artlu.xyz" },
	],

	// Disable sync for development to avoid WebSocket connection issues
	// syncUrl: undefined, // optional, defaults to https://free.evoluhq.com
});

/**
 * Format MinLengthError and MaxLengthError into human-readable messages.
 */
export const formatTypeError = createFormatTypeError<
	MinLengthError | MaxLengthError
>((error): string => {
	switch (error.type) {
		case "MinLength":
			return `Text must be at least ${error.min} character${
				error.min === 1 ? "" : "s"
			} long`;
		case "MaxLength":
			return `Text is too long (maximum ${error.max} characters)`;
	}
});
