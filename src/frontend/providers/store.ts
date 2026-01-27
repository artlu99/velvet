import type { SupportedChainId } from "@shared/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Network = "ethereum" | "base" | "tron";
export const DEFAULT_NETWORK: Network = "base";

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

interface SendState {
	/** Map of chainId -> selected token ID (CoinGecko ID) */
	selectedTokenIds: Record<string, string>;
	/** Set the selected token for a chain */
	setSelectedTokenId: (chainId: SupportedChainId, tokenId: string) => void;
	/** Get the selected token ID for a chain */
	getSelectedTokenId: (chainId: SupportedChainId) => string | undefined;
}

/**
 * Zustand store for Send page state.
 * Persists selected token per chain to sessionStorage.
 */
export const useSendStore = create<SendState>()(
	persist(
		(set, get) => ({
			selectedTokenIds: {},

			setSelectedTokenId: (chainId: SupportedChainId, tokenId: string) => {
				set((state) => ({
					selectedTokenIds: {
						...state.selectedTokenIds,
						[String(chainId)]: tokenId,
					},
				}));
			},

			getSelectedTokenId: (chainId: SupportedChainId) => {
				return get().selectedTokenIds[String(chainId)];
			},
		}),
		{
			name: "send-storage",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
);
