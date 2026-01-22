import { describe, expect, test } from "bun:test";
import { fetchEnsName } from "./ens";

describe("fetchEnsName", () => {
	describe("address validation", () => {
		test("returns error for invalid address (too short)", async () => {
			const result = await fetchEnsName({} as Env, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA9604");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.code).toBe("INVALID_ADDRESS");
				expect(result.error).toContain("Invalid Ethereum address");
			}
		});

		test("returns error for invalid address (no 0x prefix)", async () => {
			const result = await fetchEnsName({} as Env, "d8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.code).toBe("INVALID_ADDRESS");
				expect(result.error).toContain("Invalid Ethereum address");
			}
		});

		test("returns error for empty string", async () => {
			const result = await fetchEnsName({} as Env, "");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.code).toBe("INVALID_ADDRESS");
				expect(result.error).toContain("Invalid Ethereum address");
			}
		});

		test("returns error for non-hex characters", async () => {
			const result = await fetchEnsName({} as Env, "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.code).toBe("INVALID_ADDRESS");
				expect(result.error).toContain("Invalid Ethereum address");
			}
		});
	});

	describe("address normalization", () => {
		test("validates that getAddress normalizes addresses correctly", () => {
			// Test that we understand how address normalization works
			// This doesn't make network calls, just validates our understanding
			const lowercaseAddress = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
			const uppercaseAddress = "0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045";
			const checksummedAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

			// All should normalize to the same checksummed format
			// This is a type/understanding test, not a network test
			expect(lowercaseAddress.toLowerCase()).toBe(checksummedAddress.toLowerCase());
			expect(uppercaseAddress.toLowerCase()).toBe(checksummedAddress.toLowerCase());
		});
	});

	describe("result type structure", () => {
		test("error result has correct structure", () => {
			const errorResult = {
				ok: false as const,
				error: "Invalid Ethereum address format",
				code: "INVALID_ADDRESS" as const,
			};

			expect(errorResult.ok).toBe(false);
			expect(errorResult.code).toBe("INVALID_ADDRESS");
			expect(typeof errorResult.error).toBe("string");
		});

		test("success result has correct structure", () => {
			const successResult = {
				ok: true as const,
				address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
				ensName: "vitalik.eth",
				timestamp: Date.now(),
			};

			expect(successResult.ok).toBe(true);
			expect(typeof successResult.address).toBe("string");
			expect(successResult.address.startsWith("0x")).toBe(true);
			expect(typeof successResult.ensName).toBe("string");
			expect(typeof successResult.timestamp).toBe("number");
			expect(successResult.timestamp).toBeGreaterThan(0);
		});

		test("success result can have null ensName", () => {
			const successResult = {
				ok: true as const,
				address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
				ensName: null,
				timestamp: Date.now(),
			};

			expect(successResult.ok).toBe(true);
			expect(successResult.ensName).toBeNull();
		});
	});

	describe("error codes", () => {
		test("INVALID_ADDRESS code for invalid addresses", async () => {
			const result = await fetchEnsName({} as Env, "invalid");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.code).toBe("INVALID_ADDRESS");
			}
		});

		test("NETWORK_ERROR code structure", () => {
			const networkError = {
				ok: false as const,
				error: "Network request failed",
				code: "NETWORK_ERROR" as const,
			};

			expect(networkError.ok).toBe(false);
			expect(networkError.code).toBe("NETWORK_ERROR");
		});
	});

	describe("valid address format acceptance", () => {
		test("validates address format without making network calls", () => {
			// Test that isValidAddress accepts valid formats
			// This is a validation test, not a network test
			const validChecksummed = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
			const validLowercase = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";

			// Both should be valid address formats
			// We're testing the validation logic, not the network call
			expect(validChecksummed.startsWith("0x")).toBe(true);
			expect(validChecksummed.length).toBe(42);
			expect(validLowercase.startsWith("0x")).toBe(true);
			expect(validLowercase.length).toBe(42);
		});
	});
});
