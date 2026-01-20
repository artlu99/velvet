import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), cloudflare(), tailwindcss()],
	server: { allowedHosts: ["vmi2697213.tailb8f35.ts.net"] },
	resolve: {
		alias: {
			"~": "/src/frontend",
			"@shared": "/src/shared",
		},
	},
});
