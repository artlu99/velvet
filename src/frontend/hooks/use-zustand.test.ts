import { describe, expect, test } from "bun:test";
import { Themes } from "../constants";
import { useLocalStorageZustand, useZustand } from "./use-zustand";

describe("useZustand", () => {
	test("should increment count by default amount (1)", () => {
		useZustand.setState({ count: 0 });
		useZustand.getState().increment();
		expect(useZustand.getState().count).toBe(1);
	});

	test("should increment count by custom amount", () => {
		useZustand.setState({ count: 0 });
		useZustand.getState().increment(5);
		expect(useZustand.getState().count).toBe(5);
	});

	test("should reset count to 0", () => {
		useZustand.setState({ count: 100 });
		useZustand.getState().reset();
		expect(useZustand.getState().count).toBe(0);
	});
});

describe("useLocalStorageZustand", () => {
	test("should set theme name", () => {
		useLocalStorageZustand.setState({ themeName: Themes.LIGHT });
		expect(useLocalStorageZustand.getState().themeName).toBe(Themes.LIGHT);
	});

	test("should update theme name", () => {
		useLocalStorageZustand.setState({ themeName: Themes.LIGHT });
		useLocalStorageZustand.getState().setThemeName(Themes.DARK);
		expect(useLocalStorageZustand.getState().themeName).toBe(Themes.DARK);
	});
});
