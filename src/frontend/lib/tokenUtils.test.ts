import { describe, expect, test } from "bun:test";
import type { CoinGeckoToken } from "~/providers/tokenStore";
import { getTokenAddress, getTokenDecimals, isNativeToken } from "./tokenUtils";

describe("tokenUtils", () => {
	// Test fixtures
	const ethToken: CoinGeckoToken = {
		id: "ethereum",
		symbol: "eth",
		name: "Ethereum",
		platforms: {
			ethereum: "",
			base: "",
		},
		detail_platforms: {
			ethereum: {
				decimal_place: 18,
				contract_address: "",
			},
			base: {
				decimal_place: 18,
				contract_address: "",
			},
		},
	};

	const usdcToken: CoinGeckoToken = {
		id: "usd-coin",
		symbol: "usdc",
		name: "USD Coin",
		platforms: {
			base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		detail_platforms: {
			base: {
				decimal_place: 6,
				contract_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			},
		},
	};

	const multiChainToken: CoinGeckoToken = {
		id: "multi-token",
		symbol: "mtk",
		name: "Multi Chain Token",
		platforms: {
			ethereum: "0x1234567890123456789012345678901234567890",
			base: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		},
		detail_platforms: {
			ethereum: {
				decimal_place: 18,
				contract_address: "0x1234567890123456789012345678901234567890",
			},
			base: {
				decimal_place: 6,
				contract_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
		},
	};

	const tokenWithoutDecimals: CoinGeckoToken = {
		id: "no-decimals",
		symbol: "nod",
		name: "No Decimals Token",
		platforms: {
			ethereum: "0x9999999999999999999999999999999999999999",
		},
		detail_platforms: {
			ethereum: {
				decimal_place: null,
				contract_address: "0x9999999999999999999999999999999999999999",
			},
		},
	};

	describe("getTokenDecimals", () => {
		test("returns 18 for ETH on Ethereum", () => {
			const result = getTokenDecimals(ethToken, 1);
			expect(result).toBe(18);
		});

		test("returns 18 for ETH on Base", () => {
			const result = getTokenDecimals(ethToken, 8453);
			expect(result).toBe(18);
		});

		test("returns 6 for USDC on Base", () => {
			const result = getTokenDecimals(usdcToken, 8453);
			expect(result).toBe(6);
		});

		test("returns different decimals for multi-chain token", () => {
			const ethDecimals = getTokenDecimals(multiChainToken, 1);
			const baseDecimals = getTokenDecimals(multiChainToken, 8453);
			expect(ethDecimals).toBe(18);
			expect(baseDecimals).toBe(6);
		});

		test("defaults to 18 when decimals are null", () => {
			const result = getTokenDecimals(tokenWithoutDecimals, 1);
			expect(result).toBe(18);
		});

		test("returns 18 for unsupported chain (default)", () => {
			const result = getTokenDecimals(ethToken, 9999 as 1 | 8453);
			expect(result).toBe(18);
		});

		test("handles token not present on chain", () => {
			const result = getTokenDecimals(usdcToken, 1 as 1 | 8453);
			expect(result).toBe(18); // Default to 18
		});
	});

	describe("getTokenAddress", () => {
		test("returns 0x0 for native ETH on Ethereum", () => {
			const result = getTokenAddress(ethToken, 1);
			expect(result).toBe("0x0");
		});

		test("returns 0x0 for native ETH on Base", () => {
			const result = getTokenAddress(ethToken, 8453);
			expect(result).toBe("0x0");
		});

		test("returns contract address for USDC on Base", () => {
			const result = getTokenAddress(usdcToken, 8453);
			expect(result).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
		});

		test("returns different addresses for multi-chain token", () => {
			const ethAddress = getTokenAddress(multiChainToken, 1);
			const baseAddress = getTokenAddress(multiChainToken, 8453);
			expect(ethAddress).toBe("0x1234567890123456789012345678901234567890");
			expect(baseAddress).toBe("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
		});

		test("returns 0x0 for unsupported chain", () => {
			const result = getTokenAddress(ethToken, 9999 as 1 | 8453);
			expect(result).toBe("0x0");
		});

		test("returns 0x0 for token not present on chain", () => {
			const result = getTokenAddress(usdcToken, 1 as 1 | 8453);
			expect(result).toBe("0x0");
		});
	});

	describe("isNativeToken", () => {
		test("returns true for ETH on Ethereum", () => {
			const result = isNativeToken(ethToken, 1);
			expect(result).toBe(true);
		});

		test("returns true for ETH on Base", () => {
			const result = isNativeToken(ethToken, 8453);
			expect(result).toBe(true);
		});

		test("returns false for USDC on Base", () => {
			const result = isNativeToken(usdcToken, 8453);
			expect(result).toBe(false);
		});

		test("returns false for multi-chain token on Ethereum", () => {
			const result = isNativeToken(multiChainToken, 1);
			expect(result).toBe(false);
		});

		test("returns false for multi-chain token on Base", () => {
			const result = isNativeToken(multiChainToken, 8453);
			expect(result).toBe(false);
		});

		test("returns true for token with empty address", () => {
			const emptyAddressToken: CoinGeckoToken = {
				...usdcToken,
				platforms: {
					base: "",
				},
			};
			const result = isNativeToken(emptyAddressToken, 8453);
			expect(result).toBe(true);
		});

		test("returns false for token with contract address", () => {
			const result = isNativeToken(usdcToken, 8453);
			expect(result).toBe(false);
		});

		test("handles token not present on chain", () => {
			const result = isNativeToken(usdcToken, 1 as 1 | 8453);
			expect(result).toBe(true); // No address means native (0x0 default)
		});
	});
});
