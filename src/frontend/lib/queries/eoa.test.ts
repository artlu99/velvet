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
			'select * from "eoa" where "isDeleted" is null order by "createdAt" desc',
		);
		expect(params).toEqual([]);
	});

	test("createEoaDuplicateCheckQuery compiles expected SQL + params", () => {
		const address = "0xabc";
		const pk = "0xdef";

		const q = createEoaDuplicateCheckQuery(evoluInstance as unknown as Evolu, address, pk);
		const [sql, params] = parseCompiledQuery(q);

		expect(sql).toBe(
			'select "address", "unencryptedPrivateKey" from "eoa" where "isDeleted" is null and ("address" = ? or "unencryptedPrivateKey" = ?)',
		);

		// Evolu encodes params as tuples; we assert the parameter values.
		expect(params).toEqual([
			["j", address],
			["j", pk],
		]);
	});
});

