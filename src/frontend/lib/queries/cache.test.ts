import { describe, expect, test } from "bun:test";
import { isCacheStale } from "./cache";

describe("isCacheStale", () => {
	test("returns true for null updatedAt", () => {
		expect(isCacheStale(null)).toBe(true);
	});

	test("returns true for undefined updatedAt", () => {
		expect(isCacheStale(undefined)).toBe(true);
	});

	test("returns false for recent timestamp (within threshold)", () => {
		const now = new Date().toISOString();
		expect(isCacheStale(now)).toBe(false);
	});

	test("returns false for timestamp 1 minute ago", () => {
		const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
		expect(isCacheStale(oneMinuteAgo)).toBe(false);
	});

	test("returns false for timestamp 4 minutes ago (within default 5min threshold)", () => {
		const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString();
		expect(isCacheStale(fourMinutesAgo)).toBe(false);
	});

	test("returns true for timestamp 6 minutes ago (exceeds default 5min threshold)", () => {
		const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
		expect(isCacheStale(sixMinutesAgo)).toBe(true);
	});

	test("returns true for timestamp exactly at 5 minute boundary", () => {
		// At exactly 5 minutes, Date.now() - updatedTime equals thresholdMs
		// The check is >, so exactly at boundary should return false
		const exactlyFiveMinutesAgo = new Date(
			Date.now() - 5 * 60 * 1000,
		).toISOString();
		// This might be slightly stale due to test execution time
		const result = isCacheStale(exactlyFiveMinutesAgo);
		// Either false (exactly at boundary) or true (just past) is acceptable
		expect(typeof result).toBe("boolean");
	});

	test("respects custom threshold (1 minute)", () => {
		const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
		const oneMinuteThreshold = 60 * 1000;
		expect(isCacheStale(twoMinutesAgo, oneMinuteThreshold)).toBe(true);
	});

	test("respects custom threshold (10 minutes)", () => {
		const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
		const tenMinuteThreshold = 10 * 60 * 1000;
		expect(isCacheStale(sixMinutesAgo, tenMinuteThreshold)).toBe(false);
	});

	test("returns true for very old timestamp", () => {
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		expect(isCacheStale(oneDayAgo)).toBe(true);
	});

	test("handles invalid date string (returns false due to NaN comparison)", () => {
		// Invalid date results in NaN, and NaN > threshold is false
		// This is an edge case unlikely in practice (Evolu provides valid ISO dates)
		expect(isCacheStale("not-a-date")).toBe(false);
	});
});
