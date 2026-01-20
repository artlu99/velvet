import { create } from "zustand";
import { combine, createJSONStorage, persist } from "zustand/middleware";
import type { Themes } from "~/constants";

export const useZustand = create(
	persist(
		combine({ count: 0 }, (set) => ({
			increment: (by = 1) => set((state) => ({ count: state.count + by })),
			reset: () => set({ count: 0 }),
		})),
		{
			name: "zustand-store",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
);

export const useLocalStorageZustand = create(
	persist(
		combine({ themeName: null as Themes | null }, (set) => ({
			setThemeName: (themeName: Themes | null) => set({ themeName }),
		})),
		{
			name: "zustand-store",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
