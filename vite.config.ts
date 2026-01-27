import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { featureFlags } from "./src/shared/feature-flags";

// https://vite.dev/config/
export default defineConfig({
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					tron: ["tronweb"],
					dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
				},
			},
		},
	},
	optimizeDeps: {
		exclude: ["@evolu/sqlite-wasm", "kysely", "@evolu/react-web"],
		include: ["react", "react-dom", "react/jsx-runtime"],
	},
	plugins: [
		react(),
		cloudflare(),
		tailwindcss(),
		VitePWA({
			manifest: {
				theme_color: "#303041",
			},
			includeAssets: featureFlags.MUSIC_LINKS.enabled
				? Object.values(featureFlags.MUSIC_LINKS.assets)
				: [],
			pwaAssets: {
				preset: "minimal-2023",
			},
			workbox: {
				// Don't cache API routes - let them pass through to the server
				navigateFallbackDenylist: [/^\/api\/.*/],
			},
			registerType: "autoUpdate",
		}),
	],
	resolve: {
		alias: {
			"~": "/src/frontend",
			"@shared": "/src/shared",
		},
	},
});
