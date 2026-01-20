import type { AppName } from "@shared/types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import invariant from "tiny-invariant";

const app = new Hono<{ Bindings: Cloudflare.Env }>().basePath("/api");

app
	.use(cors())
	.use(secureHeaders())
	.use(csrf())
	.get("/name", (c) => {
		invariant(c.env.NAME, "NAME is not set");
		const ret: AppName = { name: c.env.NAME };
		return c.json(ret);
	});

export default app;
