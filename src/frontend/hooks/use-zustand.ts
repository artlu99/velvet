import { create } from "zustand";
import { combine, createJSONStorage, persist } from "zustand/middleware";

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
