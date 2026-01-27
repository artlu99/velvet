import { sqliteTrue } from "@evolu/common";
import type { EvoluInstance } from "../evolu";
import type {
	BalanceCacheId,
	BasenameCacheId,
	EnsCacheId,
	PriceCacheId,
	TokenBalanceCacheId,
	TokenMetadataCacheId,
} from "../schema";
import { asNonEmptyString100, asNonEmptyString1000 } from "./brandedTypes";

/**
 * Query factory for getting cached native balance for an address + chain
 */
export const createBalanceCacheQuery = (
	evolu: EvoluInstance,
	address: string,
	chainId: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("balanceCache")
			.selectAll()
			.where("address", "=", asNonEmptyString1000(address))
			.where("chainId", "=", asNonEmptyString100(chainId))
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Query factory for getting cached token balance
 */
export const createTokenBalanceCacheQuery = (
	evolu: EvoluInstance,
	address: string,
	tokenAddress: string,
	chainId: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("tokenBalanceCache")
			.selectAll()
			.where("address", "=", asNonEmptyString1000(address))
			.where("tokenAddress", "=", asNonEmptyString1000(tokenAddress))
			.where("chainId", "=", asNonEmptyString100(chainId))
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Query factory for getting cached price for a coin
 */
export const createPriceCacheQuery = (evolu: EvoluInstance, coinId: string) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("priceCache")
			.selectAll()
			.where("coinId", "=", asNonEmptyString100(coinId))
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Query factory for getting all cached prices
 */
export const createAllPricesCacheQuery = (evolu: EvoluInstance) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("priceCache")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue),
	);

/**
 * Upsert balance cache (insert or update)
 */
export async function upsertBalanceCache(
	evolu: EvoluInstance,
	data: { address: string; chainId: string; balanceRaw: string },
): Promise<void> {
	const query = createBalanceCacheQuery(evolu, data.address, data.chainId);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("balanceCache", {
			id: existing[0].id as BalanceCacheId,
			balanceRaw: data.balanceRaw,
		});
	} else {
		evolu.insert("balanceCache", {
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
	evolu: EvoluInstance,
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
		evolu.update("tokenBalanceCache", {
			id: existing[0].id as TokenBalanceCacheId,
			balanceRaw: data.balanceRaw,
		});
	} else {
		evolu.insert("tokenBalanceCache", {
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
	evolu: EvoluInstance,
	data: { coinId: string; priceUsd: number },
): Promise<void> {
	const query = createPriceCacheQuery(evolu, data.coinId);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("priceCache", {
			id: existing[0].id as PriceCacheId,
			priceUsd: data.priceUsd,
		});
	} else {
		evolu.insert("priceCache", {
			coinId: data.coinId,
			priceUsd: data.priceUsd,
		});
	}
}

/**
 * Batch upsert prices (for updating multiple prices at once)
 */
export async function upsertPricesCache(
	evolu: EvoluInstance,
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
export const createTokenMetadataCacheQuery = (
	evolu: EvoluInstance,
	coinId: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("tokenMetadataCache")
			.selectAll()
			.where("coinId", "=", asNonEmptyString100(coinId))
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Query factory for getting all cached token metadata
 */
export const createAllTokenMetadataCacheQuery = (evolu: EvoluInstance) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("tokenMetadataCache")
			.selectAll()
			.where("isDeleted", "is not", sqliteTrue),
	);

/**
 * Upsert token metadata cache (insert or update)
 */
export async function upsertTokenMetadataCache(
	evolu: EvoluInstance,
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
		evolu.update("tokenMetadataCache", {
			id: existing[0].id as TokenMetadataCacheId,
			name: data.name,
			symbol: data.symbol,
			imageThumb: data.imageThumb,
			imageSmall: data.imageSmall,
			imageLarge: data.imageLarge,
		});
	} else {
		evolu.insert("tokenMetadataCache", {
			coinId: data.coinId,
			name: data.name,
			symbol: data.symbol,
			imageThumb: data.imageThumb,
			imageSmall: data.imageSmall,
			imageLarge: data.imageLarge,
		});
	}
}

// ============================================================================
// ENS & Basename Caches
// TTL: 8 hours with stale-while-revalidate
// All caches are synced across devices
// ============================================================================

/** Query factory for getting cached ENS reverse lookup (address → name) */
export const createEnsCacheQuery = (evolu: EvoluInstance, address: string) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("ensCache")
			.selectAll()
			.where("address", "=", asNonEmptyString1000(address))
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/** Query factory for getting cached Basename reverse lookup (address → name) */
export const createBasenameCacheQuery = (
	evolu: EvoluInstance,
	address: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("basenameCache")
			.selectAll()
			.where("address", "=", asNonEmptyString1000(address))
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/** Query factory for getting cached ENS forward lookup (name → address) */
export const createEnsAddressCacheQuery = (
	evolu: EvoluInstance,
	name: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("ensAddressCache")
			.selectAll()
			.where(
				"name",
				"=",
				name.length > 0
					? asNonEmptyString100(name)
					: asNonEmptyString100("___EMPTY_SENTINEL___"),
			)
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/** Query factory for getting cached Basename forward lookup (name → address) */
export const createBasenameAddressCacheQuery = (
	evolu: EvoluInstance,
	name: string,
) =>
	evolu.createQuery((db) =>
		db
			.selectFrom("basenameAddressCache")
			.selectAll()
			.where(
				"name",
				"=",
				name.length > 0
					? asNonEmptyString100(name)
					: asNonEmptyString100("___EMPTY_SENTINEL___"),
			)
			.where("isDeleted", "is not", sqliteTrue)
			.limit(1),
	);

/**
 * Upsert ENS reverse lookup cache
 */
export async function upsertEnsCache(
	evolu: EvoluInstance,
	data: { address: string; ensName: string | null },
): Promise<void> {
	const query = createEnsCacheQuery(evolu, data.address);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("ensCache", {
			id: existing[0].id as EnsCacheId,
			ensName: data.ensName,
		});
	} else {
		await evolu.insert("ensCache", {
			address: data.address,
			ensName: data.ensName,
		});
	}
}

/**
 * Upsert Basename reverse lookup cache
 */
export async function upsertBasenameCache(
	evolu: EvoluInstance,
	data: { address: string; basename: string | null },
): Promise<void> {
	const query = createBasenameCacheQuery(evolu, data.address);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("basenameCache", {
			id: existing[0].id as BasenameCacheId,
			basename: data.basename,
		});
	} else {
		await evolu.insert("basenameCache", {
			address: data.address,
			basename: data.basename,
		});
	}
}

/**
 * Upsert ENS forward lookup cache
 */
export async function upsertEnsAddressCache(
	evolu: EvoluInstance,
	data: { name: string; address: string | null },
): Promise<void> {
	const query = createEnsAddressCacheQuery(evolu, data.name);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("ensAddressCache", {
			id: existing[0].id as EnsCacheId,
			address: data.address,
		});
	} else {
		await evolu.insert("ensAddressCache", {
			name: data.name,
			address: data.address,
		});
	}
}

/**
 * Upsert Basename forward lookup cache
 */
export async function upsertBasenameAddressCache(
	evolu: EvoluInstance,
	data: { name: string; address: string | null },
): Promise<void> {
	const query = createBasenameAddressCacheQuery(evolu, data.name);
	const existing = await evolu.loadQuery(query);

	if (existing.length > 0) {
		evolu.update("basenameAddressCache", {
			id: existing[0].id as BasenameCacheId,
			address: data.address,
		});
	} else {
		await evolu.insert("basenameAddressCache", {
			name: data.name,
			address: data.address,
		});
	}
}

/**
 * Check if name resolution cache is stale (older than 8 hours)
 * @param updatedAt - ISO date string from Evolu's updatedAt column
 */
export function isNameCacheStale(
	updatedAt: string | null | undefined,
): boolean {
	return isCacheStale(updatedAt, 8 * 60 * 60 * 1000); // 8 hours
}
