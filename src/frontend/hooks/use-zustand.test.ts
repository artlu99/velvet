import { describe, expect, test } from "bun:test";
import { useZustand } from "./use-zustand";

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
