import { describe, expect, test } from "bun:test";
import {
    fetchBalance,
    isSupportedChainId,
    isValidAddress,
    parseChainId,
} from "./balance";

describe("isValidAddress", () => {
    test("returns true for valid checksummed address", () => {
        expect(isValidAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(
            true,
        );
    });

    test("returns true for valid lowercase address", () => {
        expect(isValidAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe(
            true,
        );
    });

    test("returns false for invalid address (too short)", () => {
        expect(isValidAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA9604")).toBe(
            false,
        );
    });

    test("returns false for invalid address (no 0x prefix)", () => {
        expect(isValidAddress("d8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(
            false,
        );
    });

    test("returns false for empty string", () => {
        expect(isValidAddress("")).toBe(false);
    });

    test("returns false for non-hex characters", () => {
        expect(isValidAddress("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")).toBe(
            false,
        );
    });
});

describe("isSupportedChainId", () => {
    test("returns true for Ethereum mainnet (1)", () => {
        expect(isSupportedChainId(1)).toBe(true);
    });

    test("returns true for Base (8453)", () => {
        expect(isSupportedChainId(8453)).toBe(true);
    });

    test("returns false for unsupported chain", () => {
        expect(isSupportedChainId(137)).toBe(false);
    });

    test("returns false for zero", () => {
        expect(isSupportedChainId(0)).toBe(false);
    });
});

describe("parseChainId", () => {
    test("parses valid integer string", () => {
        expect(parseChainId("1")).toBe(1);
        expect(parseChainId("8453")).toBe(8453);
    });

    test("returns null for undefined", () => {
        expect(parseChainId(undefined)).toBeNull();
    });

    test("returns null for non-numeric string", () => {
        expect(parseChainId("abc")).toBeNull();
    });

    test("returns null for empty string", () => {
        expect(parseChainId("")).toBeNull();
    });
});

describe("discriminated union", () => {
    test("error response has ok: false", () => {
        const error = {
            ok: false as const,
            error: "Some error",
            code: "API_ERROR" as const,
        };
        expect(error.ok).toBe(false);
    });

    test("success response has ok: true", () => {
        const success = {
            ok: true as const,
            address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
            chainId: 1 as const,
            balanceWei: "1000000000000000000",
            balanceEth: "1.0",
            timestamp: Date.now(),
        };
        expect(success.ok).toBe(true);
    });
});

describe("fetchBalance", () => {
    // Integration tests: only run when ETHERSCAN_API_KEY is provided.
    // This prevents network calls in CI by default, but still allows them
    // to run anywhere (including CI) when the key is set.

    const TEST_ADDRESS = "0x094f1608960A3cb06346cFd55B10b3cEc4f72c78"; // Test address with balances on both mainnet and Base
    const API_KEY = process.env.ETHERSCAN_API_KEY;
    const itIfApiKey = API_KEY ? test : test.skip;
    const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

    if (!API_KEY && !isCi) {
        console.warn(
            "Skipping fetchBalance integration tests: set ETHERSCAN_API_KEY to enable them.",
        );
    }

    itIfApiKey("fetches balance for mainnet address", async () => {
        const result = await fetchBalance(TEST_ADDRESS, 1, API_KEY!);
        if (!result.ok) return;

        expect(result.address).toBe(TEST_ADDRESS);
        expect(result.chainId).toBe(1);
        expect(typeof result.balanceWei).toBe("string");
        expect(typeof result.balanceEth).toBe("string");
        expect(BigInt(result.balanceWei)).toBeGreaterThan(0n);
        expect(Number.parseFloat(result.balanceEth)).toBeGreaterThan(0);
        expect(result.timestamp).toBeGreaterThan(0);
    }, 30_000);

    itIfApiKey("fetches balance for Base address", async () => {
        const result = await fetchBalance(TEST_ADDRESS, 8453, API_KEY!);
        if (!result.ok) return;

        expect(result.address).toBe(TEST_ADDRESS);
        expect(result.chainId).toBe(8453);
        expect(typeof result.balanceWei).toBe("string");
        expect(typeof result.balanceEth).toBe("string");
        expect(BigInt(result.balanceWei)).toBeGreaterThan(0n);
        expect(Number.parseFloat(result.balanceEth)).toBeGreaterThan(0);
    }, 30_000);
});
