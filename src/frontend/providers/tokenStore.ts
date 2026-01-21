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
		chainId: number,
	) => CoinGeckoToken | undefined;
	// Get all tokens for a specific chain
	getTokensByChain: (chainId: number) => CoinGeckoToken[];
	// Update token (for manual editing via DevTools)
	updateToken: (id: string, token: CoinGeckoToken) => void;
	// Add new token
	addToken: (token: CoinGeckoToken) => void;
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
	"usd-coin": {
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

			getTokenByAddress: (address: string, chainId: number) => {
				const { lookupMap, tokens } = get();
				// Map chainId to CoinGecko platform ID
				const platformId =
					chainId === 1
						? "ethereum"
						: chainId === 8453
							? "base"
							: String(chainId);
				const key = `${platformId}:${address || "0x0"}`;
				const tokenId = lookupMap[key];
				return tokenId ? tokens[tokenId] : undefined;
			},

			getTokensByChain: (chainId: number) => {
				const { tokens } = get();
				const platformId =
					chainId === 1
						? "ethereum"
						: chainId === 8453
							? "base"
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
		}),
		{
			name: "token-metadata-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
