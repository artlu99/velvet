import { describe, expect, test } from "bun:test";
import type { Evolu } from "@evolu/common";
import { evoluInstance } from "../evolu";
import {
	createAllEoasQuery,	
	createEoaByAddressAnyQuery,
	normalizeAddressForQuery,
} from "./eoa";

type CompiledQuery = [sql: string, params: unknown[], meta: unknown[]];

const parseCompiledQuery = (q: string): CompiledQuery =>
	JSON.parse(q) as CompiledQuery;

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

	test("createEoaByAddressAnyQuery compiles expected SQL + params", () => {
		const address = "0xabc";

		const q = createEoaByAddressAnyQuery(
			evoluInstance as unknown as Evolu,
			address,
		);
		const [sql, params] = parseCompiledQuery(q);

		// This query does NOT filter by isDeleted (used for finding existing records including deleted ones)
		expect(sql).toBe(
			'select * from "eoa" where "address" = ? limit ?',
		);

		// Evolu encodes params as tuples; first is address, second is limit
		expect(params.length).toBe(2);
		expect(params[0]).toContain(address);
		expect(params[1]).toContain(1); // limit 1
	});
});

describe("normalizeAddressForQuery", () => {
	test("should normalize lowercase EVM address to checksummed format", () => {
		const lowercase = "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf";
		const expected = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
		expect(normalizeAddressForQuery(lowercase)).toBe(expected);
	});

	test("should return same checksummed address if already normalized", () => {
		const checksummed = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
		expect(normalizeAddressForQuery(checksummed)).toBe(checksummed);
	});

	test("should not modify Tron addresses", () => {
		const tronAddress = "TJYeasTPa6gpEEft3AuLvSAb6DjV8fQk3F";
		expect(normalizeAddressForQuery(tronAddress)).toBe(tronAddress);
	});

	test("should not modify non-EVM addresses", () => {
		const btcAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
		expect(normalizeAddressForQuery(btcAddress)).toBe(btcAddress);
	});

	test("should return invalid EVM address as-is (does not crash)", () => {
		// Invalid 0x address (wrong format) - should still return as-is
		const invalidEvmAddress = "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG";
		expect(normalizeAddressForQuery(invalidEvmAddress)).toBe(invalidEvmAddress);
	});
});

describe("Address case-insensitive matching", () => {
	test("same address with different cases should normalize to same value", () => {
		const lowercase = "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf";
		const checksummed = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";

		// Both should normalize to the same checksummed format
		expect(normalizeAddressForQuery(lowercase)).toBe(
			normalizeAddressForQuery(checksummed),
		);
	});

	test("watch-only (lowercase) and private key (checksummed) imports normalize to same address", () => {
		// Simulate watch-only import with lowercase address
		const watchOnlyAddress = "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf";
		// Simulate private key import deriving checksummed address
		const privateKeyDerivedAddress =
			"0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";

		const normalizedWatchOnly = normalizeAddressForQuery(watchOnlyAddress);
		const normalizedPrivateKey = normalizeAddressForQuery(
			privateKeyDerivedAddress,
		);

		// After normalization, both should be identical
		expect(normalizedWatchOnly).toBe(normalizedPrivateKey);
		expect(normalizedWatchOnly).toBe(
			"0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
		);
	});
});

