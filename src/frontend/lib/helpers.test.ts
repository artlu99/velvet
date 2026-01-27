import { describe, expect, test } from "bun:test";
import {
	formatPriceAge,
	formatTrc20,
	formatUsd,
	formatWithLocale,
	getPriceOpacity,
	pluralize,
} from "./helpers";

describe("helpers", () => {
	describe("formatPriceAge", () => {
		test("returns 'fresh (<5 mins)' for recent prices", () => {
			const now = Date.now();
			expect(formatPriceAge(now - 2 * 60 * 1000)).toBe("fresh (<5 mins)");
			expect(formatPriceAge(now - 4 * 60 * 1000)).toBe("fresh (<5 mins)");
		});

		test("returns 'slightly stale (<10 mins)' for moderate age", () => {
			const now = Date.now();
			expect(formatPriceAge(now - 5 * 60 * 1000)).toBe(
				"slightly stale (<10 mins)",
			);
			expect(formatPriceAge(now - 9 * 60 * 1000)).toBe(
				"slightly stale (<10 mins)",
			);
		});

		test("returns 'very stale (>=10 mins)' for old prices", () => {
			const now = Date.now();
			expect(formatPriceAge(now - 10 * 60 * 1000)).toBe(
				"very stale (>=10 mins)",
			);
			expect(formatPriceAge(now - 60 * 60 * 1000)).toBe(
				"very stale (>=10 mins)",
			);
		});
	});

	describe("getPriceOpacity", () => {
		test("returns 1.0 for fresh prices (<5 mins)", () => {
			const now = Date.now();
			expect(getPriceOpacity(now - 2 * 60 * 1000)).toBe(1.0);
			expect(getPriceOpacity(now - 4 * 60 * 1000)).toBe(1.0);
		});

		test("returns 0.8 for slightly stale prices (5-10 mins)", () => {
			const now = Date.now();
			expect(getPriceOpacity(now - 5 * 60 * 1000)).toBe(0.8);
			expect(getPriceOpacity(now - 9 * 60 * 1000)).toBe(0.8);
		});

		test("returns 0.6 for very stale prices (>=10 mins)", () => {
			const now = Date.now();
			expect(getPriceOpacity(now - 10 * 60 * 1000)).toBe(0.6);
			expect(getPriceOpacity(now - 60 * 60 * 1000)).toBe(0.6);
		});
	});

	describe("pluralize", () => {
		test("returns singular form when count is 1", () => {
			expect(pluralize(1, "wallet")).toBe("1 wallet");
			expect(pluralize(1, "item")).toBe("1 item");
		});

		test("returns plural form with 's' when count is not 1 and no plural provided", () => {
			expect(pluralize(0, "wallet")).toBe("0 wallets");
			expect(pluralize(2, "wallet")).toBe("2 wallets");
			expect(pluralize(10, "item")).toBe("10 items");
		});

		test("returns custom plural form when provided", () => {
			expect(pluralize(0, "person", "people")).toBe("0 people");
			expect(pluralize(2, "person", "people")).toBe("2 people");
			expect(pluralize(1, "person", "people")).toBe("1 person");
		});

		test("handles edge cases", () => {
			expect(pluralize(-1, "item")).toBe("-1 items"); // -1 !== 1, so plural
			expect(pluralize(-2, "item")).toBe("-2 items");
			expect(pluralize(1000, "item")).toBe("1000 items");
		});
	});

	describe("formatUsd", () => {
		test("formats USD values with 2 decimal places", () => {
			expect(formatUsd.format(1234.56)).toBe("1,234.56");
			expect(formatUsd.format(0.99)).toBe("0.99");
			expect(formatUsd.format(1000000)).toBe("1,000,000.00");
		});

		test("handles small values", () => {
			expect(formatUsd.format(0)).toBe("0.00");
			expect(formatUsd.format(0.01)).toBe("0.01");
		});

		test("uses locale-aware thousands separator", () => {
			// In en-US locale, this should have commas
			const result = formatUsd.format(999999.99);
			expect(result).toContain(",");
		});
	});

	describe("formatWithLocale", () => {
		test("formats numbers with 2-6 decimal places", () => {
			// formatWithLocale uses minimumFractionDigits: 2, maximumFractionDigits: 6
			const result = formatWithLocale.format(1234.5678);
			expect(result).toContain("1,234");
			expect(result).toContain("5678"); // preserves up to 6 decimal places
		});

		test("handles whole numbers with minimum 2 decimal places", () => {
			expect(formatWithLocale.format(100)).toBe("100.00");
		});

		test("handles small decimals with minimum 2 decimal places", () => {
			// 0.000001 will be shown as 0.00 due to minimumFractionDigits: 2
			// but the value is preserved in the formatter
			expect(formatWithLocale.format(0.12)).toBe("0.12");
			expect(formatWithLocale.format(0.123456)).toBe("0.123456");
		});
	});

	describe("formatTrc20", () => {
		test("formats TRC20 values with 0-2 decimal places", () => {
			// minimumFractionDigits: 0, maximumFractionDigits: 2
			expect(formatTrc20.format(1234.56)).toBe("1,234.56");
			expect(formatTrc20.format(0.99)).toBe("0.99");
			expect(formatTrc20.format(100)).toBe("100"); // No decimal for whole numbers
		});

		test("handles values with 1 decimal place", () => {
			expect(formatTrc20.format(100.4)).toBe("100.4");
			expect(formatTrc20.format(1.5)).toBe("1.5");
		});

		test("handles zero", () => {
			expect(formatTrc20.format(0)).toBe("0");
		});
	});
});
