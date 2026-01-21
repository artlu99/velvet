import { describe, expect, test } from "bun:test";
import {
	calculateTotalCost,
	ethToWei,
	formatGwei,
	formatWeiForDisplay,
	isValidAddress,
	truncateAddress,
	weiToEth,
} from "./transaction";

describe("transaction utilities", () => {
	describe("ethToWei", () => {
		test("converts 1 ETH to wei", () => {
			const result = ethToWei("1");
			expect(result).toBe("1000000000000000000");
		});

		test("converts 0.5 ETH to wei", () => {
			const result = ethToWei("0.5");
			expect(result).toBe("500000000000000000");
		});

		test("converts decimal ETH to wei", () => {
			const result = ethToWei("1.5");
			expect(result).toBe("1500000000000000000");
		});

		test("throws on invalid input", () => {
			expect(() => ethToWei("invalid")).toThrow();
		});

		test("converts negative input (viem handles this)", () => {
			// viem's parseEther accepts negative values
			const result = ethToWei("-1");
			expect(result).toBe("-1000000000000000000");
		});
	});

	describe("weiToEth", () => {
		test("converts wei to ETH", () => {
			const result = weiToEth("1000000000000000000");
			expect(result).toBe("1");
		});

		test("converts wei to decimal ETH", () => {
			const result = weiToEth("500000000000000000");
			expect(result).toBe("0.5");
		});

		test("handles large wei values", () => {
			const result = weiToEth("10000000000000000000");
			expect(result).toBe("10");
		});
	});

	describe("formatGwei", () => {
		test("formats wei to Gwei", () => {
			const result = formatGwei("1000000000");
			expect(result).toBe("1.00");
		});

		test("formats wei to Gwei with decimals", () => {
			const result = formatGwei("1500000000");
			expect(result).toBe("1.50");
		});

		test("handles small values", () => {
			const result = formatGwei("100000000");
			expect(result).toBe("0.10");
		});
	});

	describe("calculateTotalCost", () => {
		test("calculates total cost including gas", () => {
			const result = calculateTotalCost(
				"1000000000000000000", // 1 ETH
				"21000", // gas limit
				"50000000000", // 50 Gwei
			);
			// Value: 1000000000000000000
			// Gas: 21000 * 50000000000 = 1050000000000000
			// Total: 1001050000000000000
			expect(result).toBe("1001050000000000000");
		});

		test("handles zero value", () => {
			const result = calculateTotalCost(
				"0",
				"21000",
				"50000000000",
			);
			expect(result).toBe("1050000000000000");
		});

		test("handles large values", () => {
			const result = calculateTotalCost(
				"10000000000000000000", // 10 ETH
				"100000", // higher gas limit
				"100000000000", // 100 Gwei
			);
			// Value: 10000000000000000000
			// Gas: 100000 * 100000000000 = 10000000000000000
			// Total: 10010000000000000000
			expect(result).toBe("10010000000000000000");
		});
	});

	describe("isValidAddress", () => {
		test("returns true for valid checksummed address", () => {
			const result = isValidAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9");
			expect(result).toBe(true);
		});

		test("returns true for valid lowercase address", () => {
			const result = isValidAddress("0x742d35cc6634c0532925a3b844bc9e7595f0beb9");
			expect(result).toBe(true);
		});

		test("returns true for valid uppercase address", () => {
			const result = isValidAddress("0x742D35CC6634C0532925A3B844BC9E7595F0BEB9");
			expect(result).toBe(true);
		});

		test("returns false for address without 0x prefix", () => {
			const result = isValidAddress("742d35cc6634c0532925a3b844bc9e7595f0bebd");
			expect(result).toBe(false);
		});

		test("returns false for too short address", () => {
			const result = isValidAddress("0x1234");
			expect(result).toBe(false);
		});

		test("returns false for too long address", () => {
			const result = isValidAddress("0x742d35cc6634c0532925a3b844bc9e7595f0bebdeadbeef");
			expect(result).toBe(false);
		});

		test("returns false for address with invalid characters", () => {
			const result = isValidAddress("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG");
			expect(result).toBe(false);
		});
	});

	describe("truncateAddress", () => {
		test("truncates standard address", () => {
			const result = truncateAddress("0x742d35cc6634c0532925a3b844bc9e7595f0beb9");
			expect(result).toBe("0x742d...beb9");
		});

		test("handles short addresses", () => {
			const result = truncateAddress("0x1234");
			expect(result).toBe("0x1234");
		});

		test("handles exact 10 character length", () => {
			const result = truncateAddress("0x12345678");
			expect(result).toBe("0x12345678");
		});
	});

	describe("formatWeiForDisplay", () => {
		test("formats wei to ETH with 6 decimals", () => {
			const result = formatWeiForDisplay("1000000000000000000");
			expect(result).toBe("1");
		});

		test("truncates to 6 decimals", () => {
			const result = formatWeiForDisplay("1234567890123456789");
			expect(result).toBe("1.234567");
		});

		test("handles small values", () => {
			const result = formatWeiForDisplay("1000000000000000");
			expect(result).toBe("0.001");
		});

		test("handles zero", () => {
			const result = formatWeiForDisplay("0");
			expect(result).toBe("0");
		});
	});
});
