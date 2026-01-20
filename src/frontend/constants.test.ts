import { describe, expect, test } from "bun:test";
import { Themes } from "./constants";

describe("Themes", () => {
	test("should have LIGHT theme as 'bumblebee'", () => {
		expect(Themes.LIGHT).toBe("bumblebee" as Themes);
	});

	test("should have DARK theme as 'luxury'", () => {
		expect(Themes.DARK).toBe("luxury" as Themes);
	});

	test("should have exactly 2 themes", () => {
		const themeValues = Object.keys(Themes);
		expect(themeValues).toHaveLength(2);
	});
});
