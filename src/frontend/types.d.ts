/// <reference types="vite-plugin-pwa/client" />

declare module "*.css" {
	const content: string;
	export default content;
}

declare module "remixicon/fonts/remixicon.css" {
	const content: string;
	export default content;
}
