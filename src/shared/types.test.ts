import { describe, expect, test } from "bun:test";
import type { AppName } from "./types";

describe("Shared Types", () => {
	test("AppName type should accept valid shape", () => {
		const appName: AppName = { name: "Test App" };
		expect(appName.name).toBe("Test App");
	});

	test("AppName type should require name property", () => {
		// @ts-expect-error - missing name property
		const invalid: AppName = {};
		expect(invalid.name).toBeUndefined();
	});
});
