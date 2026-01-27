/**
 * Feature flag definitions.
 *
 * Each feature flag defines:
 * - Whether the feature is enabled
 * - Optional metadata about the feature
 *
 * Usage:
 *   import { featureFlags } from "@shared/feature-flags";
 *
 *   if (featureFlags.MUSIC_LINKS.enabled) {
 *     // Show music-related content
 *   }
 */

export const featureFlags = {
	/**
	 * Music-related links and images (album art, YouTube links)
	 *
	 * NOTE: If you disable this or change the 'landing' asset,
	 * you MUST manually update the <link rel="preload"> tag in index.html
	 * as it cannot read from this config at build time.
	 */
	MUSIC_LINKS: {
		enabled: true,
		assets: {
			landing: "3e887299569d62da0a813ec6bac7e91d.jpg",
			nowPlaying:
				"the-velvet-underground-now-playing-silver-vinyl-cover-art.webp",
		},
	},

	/** Bitcoin wallet support (derivation, address validation, transactions) */
	BITCOIN: {
		enabled: false,
	},

	/** Solana wallet support (derivation, address validation, transactions) */
	SOLANA: {
		enabled: false,
	},
} as const;

/** Type-safe accessor for feature flag names */
export type FeatureFlagName = keyof typeof featureFlags;

/** Type-safe accessor for feature flag config */
export type FeatureFlagConfig = (typeof featureFlags)[FeatureFlagName];
