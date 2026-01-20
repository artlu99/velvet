import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";
import App from "~/App.tsx";

import "remixicon/fonts/remixicon.css";
import "~/index.css";

const root = document.getElementById("root");
invariant(root, "Root element not found");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
