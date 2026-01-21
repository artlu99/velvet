import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";
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
