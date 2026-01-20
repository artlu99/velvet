import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
	optimizeDeps: {
		exclude: ["@evolu/sqlite-wasm", "kysely", "@evolu/react-web"],
		include: ["react", "react-dom", "react/jsx-runtime"],
	  },	
	plugins: [react(), cloudflare(), tailwindcss(), 
	    VitePWA({
			pwaAssets: {
				preset: 'minimal-2023'
			  },
		
			registerType: 'autoUpdate' })
	],
	server: { allowedHosts: ["vmi2697213.tailb8f35.ts.net"] },
	resolve: {
		alias: {
			"~": "/src/frontend",
			"@shared": "/src/shared",
		},
	},
});
