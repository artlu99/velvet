import type { Evolu } from "@evolu/common";
import { sqliteTrue } from "@evolu/common";
import type {
	BalanceCacheId,
	PriceCacheId,
	TokenBalanceCacheId,
	TokenMetadataCacheId,
} from "../schema";

/**
 * Query factory for getting cached native balance for an address + chain
 */
export const createBalanceCacheQuery = (
	evolu: Evolu,
	address: string,
	chainId: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("_balanceCache")
			.selectAll()
			.where("address", "=", address)
			.where("chainId", "=", chainId)
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Query factory for getting cached token balance
 */
export const createTokenBalanceCacheQuery = (
	evolu: Evolu,
	address: string,
	tokenAddress: string,
	chainId: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("_tokenBalanceCache")
			.selectAll()
			.where("address", "=", address)
			.where("tokenAddress", "=", tokenAddress)
			.where("chainId", "=", chainId)
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Query factory for getting cached price for a coin
 */
export const createPriceCacheQuery = (evolu: Evolu, coinId: string) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("_priceCache")
			.selectAll()
			.where("coinId", "=", coinId)
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Query factory for getting all cached prices
 */
export const createAllPricesCacheQuery = (evolu: Evolu) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("_priceCache")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue),
	);

/**
 * Upsert balance cache (insert or update)
 */
export async function upsertBalanceCache(
	evolu: Evolu,
	data: { address: string; chainId: string; balanceRaw: string },
): Promise<void> {
	const query = createBalanceCacheQuery(evolu, data.address, data.chainId);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("_balanceCache", {
			id: existing[0].id as BalanceCacheId,
			balanceRaw: data.balanceRaw,
		});
	} else {
		evolu.insert("_balanceCache", {
			address: data.address,
			chainId: data.chainId,
			balanceRaw: data.balanceRaw,
		});
	}
}

/**
 * Upsert token balance cache (insert or update)
 */
export async function upsertTokenBalanceCache(
	evolu: Evolu,
	data: {
		address: string;
		tokenAddress: string;
		chainId: string;
		balanceRaw: string;
	},
): Promise<void> {
	const query = createTokenBalanceCacheQuery(
		evolu,
		data.address,
		data.tokenAddress,
		data.chainId,
	);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("_tokenBalanceCache", {
			id: existing[0].id as TokenBalanceCacheId,
			balanceRaw: data.balanceRaw,
		});
	} else {
		evolu.insert("_tokenBalanceCache", {
			address: data.address,
			tokenAddress: data.tokenAddress,
			chainId: data.chainId,
			balanceRaw: data.balanceRaw,
		});
	}
}

/**
 * Upsert price cache (insert or update)
 */
export async function upsertPriceCache(
	evolu: Evolu,
	data: { coinId: string; priceUsd: number },
): Promise<void> {
	const query = createPriceCacheQuery(evolu, data.coinId);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("_priceCache", {
			id: existing[0].id as PriceCacheId,
			priceUsd: data.priceUsd,
		});
	} else {
		evolu.insert("_priceCache", {
			coinId: data.coinId,
			priceUsd: data.priceUsd,
		});
	}
}

/**
 * Batch upsert prices (for updating multiple prices at once)
 */
export async function upsertPricesCache(
	evolu: Evolu,
	prices: Record<string, { usd: number }>,
): Promise<void> {
	// Process each price - Evolu batches mutations in a microtask
	for (const [coinId, { usd }] of Object.entries(prices)) {
		await upsertPriceCache(evolu, { coinId, priceUsd: usd });
	}
}

/**
 * Check if cached data is stale (older than threshold)
 * @param updatedAt - ISO date string from Evolu's updatedAt column
 * @param thresholdMs - Staleness threshold in milliseconds (default: 5 minutes)
 */
export function isCacheStale(
	updatedAt: string | null | undefined,
	thresholdMs = 5 * 60 * 1000,
): boolean {
	if (!updatedAt) return true;
	const updatedTime = new Date(updatedAt).getTime();
	return Date.now() - updatedTime > thresholdMs;
}

/**
 * Query factory for getting cached token metadata for a coin
 */
export const createTokenMetadataCacheQuery = (evolu: Evolu, coinId: string) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("_tokenMetadataCache")
			.selectAll()
			.where("coinId", "=", coinId)
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Query factory for getting all cached token metadata
 */
export const createAllTokenMetadataCacheQuery = (evolu: Evolu) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("_tokenMetadataCache")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue),
	);

/**
 * Upsert token metadata cache (insert or update)
 */
export async function upsertTokenMetadataCache(
	evolu: Evolu,
	data: {
		coinId: string;
		name: string;
		symbol: string;
		imageThumb: string;
		imageSmall: string;
		imageLarge: string;
	},
): Promise<void> {
	const query = createTokenMetadataCacheQuery(evolu, data.coinId);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("_tokenMetadataCache", {
			id: existing[0].id as TokenMetadataCacheId,
			name: data.name,
			symbol: data.symbol,
			imageThumb: data.imageThumb,
			imageSmall: data.imageSmall,
			imageLarge: data.imageLarge,
		});
	} else {
		evolu.insert("_tokenMetadataCache", {
			coinId: data.coinId,
			name: data.name,
			symbol: data.symbol,
			imageThumb: data.imageThumb,
			imageSmall: data.imageSmall,
			imageLarge: data.imageLarge,
		});
	}
}
