import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

interface PortfolioStoreState {
	readonly globalTotal: number;
	readonly lastUpdate: number;
}

interface PortfolioStoreActions {
	readonly setGlobalTotal: (total: number) => void;
	readonly isExpired: () => boolean;
	readonly reset: () => void;
}

type PortfolioStore = PortfolioStoreState & PortfolioStoreActions;

const initialState: PortfolioStoreState = {
	globalTotal: 0,
	lastUpdate: 0,
};

export const usePortfolioStore = create<PortfolioStore>()(
	persist(
		(set, get) => ({
			...initialState,

			setGlobalTotal: (total: number) => {
				set({
					globalTotal: total,
					lastUpdate: Date.now(),
				});
			},

			isExpired: () => {
				const { lastUpdate } = get();
				if (lastUpdate === 0) return true;
				const age = Date.now() - lastUpdate;
				return age >= FIVE_MINUTES_MS;
			},

			reset: () => {
				set(initialState);
			},
		}),
		{
			name: "portfolio-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
