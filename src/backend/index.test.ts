import { describe, expect, test } from "bun:test";
import app from "./index";

describe("GET /api/name", () => {
	test("should return app name and include security headers", async () => {
		const mockEnv = { NAME: "TestApp" };
		const res = await app.request("/api/name", {}, mockEnv);

		expect(res.status).toBe(200);

		const json = await res.json();
		expect(json).toEqual({ name: "TestApp" });

		// Verify security headers from middleware
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(res.headers.get("access-control-allow-origin")).not.toBeNull();
	});
});
