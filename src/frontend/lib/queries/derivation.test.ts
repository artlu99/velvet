import { describe, expect, test } from "bun:test";
import type { Evolu } from "@evolu/common";
import { createAllDerivedKeysQuery } from "./derivation";

// Mock Evolu instance for query compilation tests
const mockEvolu = {
	createQuery: (fn: any) => fn,
} as unknown as Evolu;

describe("derivation queries", () => {
	test("createAllDerivedKeysQuery compiles correctly", () => {
		const query = createAllDerivedKeysQuery(mockEvolu);
		expect(query).toBeDefined();
	});
});
