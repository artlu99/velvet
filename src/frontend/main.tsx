import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";

// Extend Buffer with base64url support (vite-plugin-node-polyfills doesn't include it)
if (typeof globalThis.Buffer !== "undefined") {
	const Buffer = globalThis.Buffer;
	const originalToString = Buffer.prototype.toString;
	Buffer.prototype.toString = function (encoding?: string): string {
		if (encoding === "base64url") {
			return this.toString("base64")
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");
		}
		return originalToString.call(this, encoding as never);
	};
	const originalFrom = Buffer.from;
	Buffer.from = ((
		value: string | ArrayBuffer | ArrayLike<number> | Buffer,
		encodingOrOffset?: string | number,
		length?: number,
	): Buffer => {
		if (
			typeof value === "string" &&
			typeof encodingOrOffset === "string" &&
			encodingOrOffset === "base64url"
		) {
			const base64 =
				value.replace(/-/g, "+").replace(/_/g, "/") +
				"=".repeat((4 - (value.length % 4)) % 4);
			return (originalFrom as unknown as (v: string, e: string) => Buffer)(
				base64,
				"base64",
			);
		}
		return (
			originalFrom as unknown as (
				v: string | ArrayBuffer | ArrayLike<number> | Buffer,
				e?: string | number,
				l?: number,
			) => Buffer
		)(value, encodingOrOffset, length);
	}) as typeof Buffer.from;
}

import App from "~/App.tsx";

import "@fortawesome/fontawesome-free/css/all.min.css";
import "~/index.css";

registerSW({ immediate: true });

const root = document.getElementById("root");
invariant(root, "Root element not found");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
