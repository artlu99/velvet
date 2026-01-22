import { describe, expect, test } from "bun:test";
import type { Evolu } from "@evolu/common";
import { evoluInstance } from "../evolu";
import { createAllEoasQuery, createEoaDuplicateCheckQuery } from "./eoa";

type CompiledQuery = [sql: string, params: unknown[], meta: unknown[]];

const parseCompiledQuery = (q: string): CompiledQuery => JSON.parse(q) as CompiledQuery;

describe("EOA query factories", () => {
	test("createAllEoasQuery compiles expected SQL", () => {
		const q = createAllEoasQuery(evoluInstance as unknown as Evolu);
		const [sql, params] = parseCompiledQuery(q);

		expect(sql).toBe(
			'select * from "eoa" where "isDeleted" is not ? order by "createdAt" desc',
		);
		// sqliteTrue (1) is encoded as a parameter
		expect(params.length).toBe(1);
		expect(params[0]).toContain(1);
	});

	test("createEoaDuplicateCheckQuery compiles expected SQL + params", () => {
		const address = "0xabc";

		const q = createEoaDuplicateCheckQuery(evoluInstance as unknown as Evolu, address);
		const [sql, params] = parseCompiledQuery(q);

		expect(sql).toBe(
			'select "address", "origin" from "eoa" where "isDeleted" is not ? and "address" = ?',
		);

		// Evolu encodes params as tuples; we assert the parameter values.
		// First param is sqliteTrue (1), second is address
		expect(params.length).toBe(2);
		expect(params[0]).toContain(1); // sqliteTrue
		expect(params[1]).toContain(address);
	});
});

