import type { TokenMetadataImage } from "@shared/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// CoinGecko API format (subset: id, symbol, name, platforms, detail_platforms)
export interface CoinGeckoToken {
	id: string; // CoinGecko ID (e.g., "ethereum", "usd-coin")
	symbol: string; // Token symbol (e.g., "eth", "usdc")
	name: string; // Token name (e.g., "Ethereum", "USD Coin")
	platforms: Record<string, string>; // Chain ID -> contract address (empty string for native)
	detail_platforms: Record<
		string,
		{
			decimal_place: number | null;
			contract_address: string;
		}
	>;
	image?: TokenMetadataImage; // Token logo URLs (optional, fetched from API)
}

interface TokenStoreState {
	// Map of CoinGecko ID -> token data
	tokens: Record<string, CoinGeckoToken>;
	// Helper: Map of "chainId:address" -> CoinGecko ID for fast lookup
	lookupMap: Record<string, string>;
}

interface TokenStoreActions {
	// Get token by CoinGecko ID
	getTokenById: (id: string) => CoinGeckoToken | undefined;
	// Get token by contract address + chainId
	getTokenByAddress: (
		address: string,
		chainId: number | string,
	) => CoinGeckoToken | undefined;
	// Get all tokens for a specific chain
	getTokensByChain: (chainId: number | string) => CoinGeckoToken[];
	// Update token (for manual editing via DevTools)
	updateToken: (id: string, token: CoinGeckoToken) => void;
	// Add new token
	addToken: (token: CoinGeckoToken) => void;
	// Set token images from metadata API
	setTokenImages: (images: Record<string, TokenMetadataImage>) => void;
}

const INITIAL_TOKENS: Record<string, CoinGeckoToken> = {
	ethereum: {
		id: "ethereum",
		symbol: "eth",
		name: "Ethereum",
		platforms: {
			ethereum: "", // Native on Ethereum
			base: "", // Native on Base
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
	},
	tron: {
		id: "tron",
		symbol: "trx",
		name: "TRON",
		platforms: {
			tron: "", // Native on Tron
		},
		detail_platforms: {
			tron: {
				decimal_place: 6,
				contract_address: "",
			},
		},
	},
	"usd-coin": {
		id: "usd-coin",
		symbol: "usdc",
		name: "USD Coin",
		platforms: {
			ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		detail_platforms: {
			ethereum: {
				decimal_place: 6,
				contract_address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			},
			base: {
				decimal_place: 6,
				contract_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			},
		},
	},
	tether: {
		id: "tether",
		symbol: "usdt",
		name: "Tether USD",
		platforms: {
			tron: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
		},
		detail_platforms: {
			tron: {
				decimal_place: 6,
				contract_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			},
		},
	},
};

// Build lookup map from initial tokens
const buildLookupMap = (
	tokens: Record<string, CoinGeckoToken>,
): Record<string, string> => {
	const map: Record<string, string> = {};
	for (const [id, token] of Object.entries(tokens)) {
		for (const [chainId, address] of Object.entries(token.platforms)) {
			const key = `${chainId}:${address || "0x0"}`;
			map[key] = id;
		}
	}
	return map;
};

export const useTokenStore = create<TokenStoreState & TokenStoreActions>()(
	persist(
		(set, get) => ({
			tokens: INITIAL_TOKENS,
			lookupMap: buildLookupMap(INITIAL_TOKENS),

			getTokenById: (id: string) => get().tokens[id],

			getTokenByAddress: (address: string, chainId: number | string) => {
				const { lookupMap, tokens } = get();
				// Map chainId to CoinGecko platform ID
				const platformId =
					chainId === 1
						? "ethereum"
						: chainId === 8453
							? "base"
							: chainId === "tron"
								? "tron"
								: String(chainId);
				const key = `${platformId}:${address || "0x0"}`;
				const tokenId = lookupMap[key];
				return tokenId ? tokens[tokenId] : undefined;
			},

			getTokensByChain: (chainId: number | string) => {
				const { tokens } = get();
				const platformId =
					chainId === 1
						? "ethereum"
						: chainId === 8453
							? "base"
							: chainId === "tron"
								? "tron"
								: String(chainId);
				return Object.values(tokens).filter(
					(token) => token.platforms[platformId] !== undefined,
				);
			},

			updateToken: (id: string, token: CoinGeckoToken) => {
				set((state) => {
					const newTokens = { ...state.tokens, [id]: token };
					return {
						tokens: newTokens,
						lookupMap: buildLookupMap(newTokens),
					};
				});
			},

			addToken: (token: CoinGeckoToken) => {
				set((state) => {
					const newTokens = { ...state.tokens, [token.id]: token };
					return {
						tokens: newTokens,
						lookupMap: buildLookupMap(newTokens),
					};
				});
			},

			setTokenImages: (images: Record<string, TokenMetadataImage>) => {
				set((state) => {
					const newTokens = { ...state.tokens };
					// Update tokens with new image data
					for (const [id, image] of Object.entries(images)) {
						if (newTokens[id]) {
							newTokens[id] = { ...newTokens[id], image };
						}
					}
					return { tokens: newTokens };
				});
			},
		}),
		{
			name: "token-metadata-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
