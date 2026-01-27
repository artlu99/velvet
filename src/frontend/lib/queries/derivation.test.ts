import { describe, expect, test } from "bun:test";
import { createAllDerivedKeysQuery } from "./derivation";
import { evoluInstance } from "../evolu";

describe("derivation queries", () => {
	test("createAllDerivedKeysQuery compiles correctly", () => {
		const query = createAllDerivedKeysQuery(evoluInstance);
		expect(query).toBeDefined();
	});
});
