import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Network = "ethereum" | "base";
export const DEFAULT_NETWORK: Network = "ethereum";

interface ReceiveState {
	/** Currently selected network for receiving */
	network: Network;
	/** Set the network */
	setNetwork: (network: Network) => void;
}

/**
 * Zustand store for receive page state.
 * Persists network selection to localStorage.
 */
export const useReceiveStore = create<ReceiveState>()(
	persist(
		(set) => ({
			network: DEFAULT_NETWORK,
			setNetwork: (network) => set({ network }),
		}),
		{
			name: "receive-storage",
		},
	),
);
