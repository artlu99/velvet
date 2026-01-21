import { describe, expect, test } from "bun:test";
import { buildReceiveQrValue } from "./qr";

describe("buildReceiveQrValue", () => {
	test("returns valid QR value for correct Ethereum address", () => {
		const address = "0x1234567890123456789012345678901234567890";
		const result = buildReceiveQrValue(address, 1);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(address);
		}
	});

	test("returns error for empty address", () => {
		const result = buildReceiveQrValue("", 1);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("Address is required");
		}
	});

	test("returns error for whitespace-only address", () => {
		const result = buildReceiveQrValue("   ", 1);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("Address is required");
		}
	});

	test("returns error for invalid address format - missing 0x prefix", () => {
		const result = buildReceiveQrValue("1234567890123456789012345678901234567890", 1);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("Invalid Ethereum address format");
		}
	});

	test("returns error for invalid address format - too short", () => {
		const result = buildReceiveQrValue("0x1234", 1);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("Invalid Ethereum address format");
		}
	});

	test("returns error for invalid address format - invalid characters", () => {
		const result = buildReceiveQrValue("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", 1);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("Invalid Ethereum address format");
		}
	});

	test("handles checksummed addresses (EIP-55)", () => {
		const checksummedAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbd";
		const result = buildReceiveQrValue(checksummedAddress, 8453);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(checksummedAddress);
		}
	});

	test("handles all-lowercase addresses", () => {
		const lowercaseAddress = "0x742d35cc6634c0532925a3b844bc9e7595f0bebd";
		const result = buildReceiveQrValue(lowercaseAddress, 1);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(lowercaseAddress);
		}
	});

	test("handles all-uppercase addresses", () => {
		const uppercaseAddress = "0x742D35CC6634C0532925A3B844BC9E7595F0BEBD";
		const result = buildReceiveQrValue(uppercaseAddress, 1);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(uppercaseAddress);
		}
	});
});
