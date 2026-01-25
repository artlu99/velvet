import type { PlatformMetadata } from "@shared/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PlatformStoreState {
	// Map of platform ID (e.g., "ethereum", "base", "tron") to platform metadata
	platforms: Record<string, PlatformMetadata>;
}

interface PlatformStoreActions {
	// Get platform by ID
	getPlatform: (id: string) => PlatformMetadata | undefined;
	// Set platforms from API response
	setPlatforms: (platforms: PlatformMetadata[]) => void;
	// Get platform logo URL by platform ID
	getPlatformLogo: (
		platformId: string,
		size?: "thumb" | "small" | "large",
	) => string | undefined;
}

export const usePlatformStore = create<
	PlatformStoreState & PlatformStoreActions
>()(
	persist(
		(set, get) => ({
			platforms: {},

			getPlatform: (id: string) => get().platforms[id],

			setPlatforms: (platforms: PlatformMetadata[]) => {
				const platformMap: Record<string, PlatformMetadata> = {};
				for (const platform of platforms) {
					platformMap[platform.id] = platform;
				}
				set({ platforms: platformMap });
			},

			getPlatformLogo: (platformId: string, size = "small") => {
				const platform = get().platforms[platformId];
				return platform?.image[size];
			},
		}),
		{
			name: "platform-metadata-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
