import { describe, expect, test } from "bun:test";
import { checksumAddress } from "viem";
import {
	amountToRaw,
	calculateTotalCost,
	encodeErc20Transfer,
	ethToWei,
	formatGwei,
	formatWeiForDisplay,
	rawToAmount,
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

	describe("amountToRaw", () => {
		test("converts USDC (6 decimals)", () => {
			expect(amountToRaw("100.5", 6)).toBe("100500000");
			expect(amountToRaw("0.000001", 6)).toBe("1");
			expect(amountToRaw("1", 6)).toBe("1000000");
		});

		test("converts ETH (18 decimals)", () => {
			expect(amountToRaw("1.5", 18)).toBe("1500000000000000000");
			expect(amountToRaw("0.000001", 18)).toBe("1000000000000");
			expect(amountToRaw("1", 18)).toBe("1000000000000000000");
		});

		test("handles edge cases", () => {
			expect(amountToRaw("0", 6)).toBe("0");
			expect(amountToRaw("0.0", 18)).toBe("0");
		});

		test("pads fractional part correctly", () => {
			expect(amountToRaw("1.1", 6)).toBe("1100000");
			expect(amountToRaw("1.12", 6)).toBe("1120000");
			expect(amountToRaw("1.123", 6)).toBe("1123000");
		});

		test("truncates if too many decimal places", () => {
			expect(amountToRaw("1.123456789", 6)).toBe("1123456");
		});

		test("throws on invalid input", () => {
			expect(() => amountToRaw("invalid", 6)).toThrow();
		});

		test("handles multiple decimal points (takes first two parts)", () => {
			// "1.2.3" is treated as "1.2" due to split(".")
			expect(amountToRaw("1.2.3", 6)).toBe("1200000");
		});

		test("handles very small decimals", () => {
			expect(amountToRaw("0.000000001", 18)).toBe("1000000000");
		});

		test("handles large numbers", () => {
			expect(amountToRaw("1000000", 6)).toBe("1000000000000");
		});

		test("handles zero decimal places", () => {
			expect(amountToRaw("123", 0)).toBe("123");
			expect(amountToRaw("456", 0)).toBe("456");
		});
	});

	describe("rawToAmount", () => {
		test("converts USDC base units to decimal (6 decimals)", () => {
			expect(rawToAmount("100500000", 6)).toBe("100.5");
			expect(rawToAmount("1", 6)).toBe("0.000001");
			expect(rawToAmount("1000000", 6)).toBe("1");
		});

		test("converts ETH wei to decimal (18 decimals)", () => {
			expect(rawToAmount("1500000000000000000", 18)).toBe("1.5");
			expect(rawToAmount("1000000000000000000", 18)).toBe("1");
			expect(rawToAmount("1000000000000", 18)).toBe("0.000001");
		});

		test("trims trailing zeros after decimal point", () => {
			expect(rawToAmount("1000000", 6)).toBe("1");
			expect(rawToAmount("1100000", 6)).toBe("1.1");
			expect(rawToAmount("1120000", 6)).toBe("1.12");
		});

		test("handles zero", () => {
			expect(rawToAmount("0", 6)).toBe("0");
			expect(rawToAmount("0", 18)).toBe("0");
		});

		test("handles whole numbers", () => {
			expect(rawToAmount("100000000", 6)).toBe("100");
		});

		test("throws on invalid input", () => {
			expect(() => rawToAmount("invalid", 6)).toThrow();
		});

		test("handles very small amounts", () => {
			expect(rawToAmount("1", 18)).toBe("0.000000000000000001");
		});

		test("handles large amounts", () => {
			expect(rawToAmount("1000000000000", 6)).toBe("1000000");
		});

		test("roundtrip conversion is lossless", () => {
			const original = "123.456";
			const raw = amountToRaw(original, 6);
			const converted = rawToAmount(raw, 6);
			expect(converted).toBe(original);
		});

		test("handles zero decimal places", () => {
			expect(rawToAmount("123", 0)).toBe("123");
			expect(rawToAmount("456", 0)).toBe("456");
		});
	});

	describe("encodeErc20Transfer", () => {
		const testAddress = checksumAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9" as `0x${string}`);

		test("encodes ERC20 transfer function call", () => {
			const result = encodeErc20Transfer(testAddress, "1000000");
			// Function signature: transfer(address,uint256)
			// 0xa9059cbb is the function selector for transfer
			expect(result).toMatchSnapshot();
		});

		test("encodes zero amount transfer", () => {
			const result = encodeErc20Transfer(testAddress, "0");
			expect(result).toMatchSnapshot();
		});

		test("encodes large amount transfer", () => {
			const result = encodeErc20Transfer(testAddress, "1000000000000000000000000");
			expect(result).toMatchSnapshot();
		});

		test("produces consistent output for same inputs", () => {
			const result1 = encodeErc20Transfer(testAddress, "1000000");
			const result2 = encodeErc20Transfer(testAddress, "1000000");
			expect(result1).toBe(result2);
		});

		test("function selector is correct", () => {
			const result = encodeErc20Transfer(testAddress, "1000000");
			// 0xa9059cbb is the first 4 bytes of keccak256("transfer(address,uint256)")
			expect(result.startsWith("0xa9059cbb")).toBe(true);
		});

		test("encoded data is 68 bytes (4 bytes selector + 32 bytes address + 32 bytes amount)", () => {
			const result = encodeErc20Transfer(testAddress, "1000000");
			// 0x + 64 hex chars = 68 bytes total
			expect(result.length).toBe(138); // "0x" (2) + 136 hex chars = 138 total
		});
	});
});
