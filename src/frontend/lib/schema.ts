import {
	DateIso,
	FiniteNumber,
	id,
	NonEmptyString100,
	NonEmptyString1000,
	nullOr,
	SqliteBoolean,
	union,
} from "@evolu/common";

const EoaId = id("Eoa");
export type EoaId = typeof EoaId.Type;

const ChainId = id("Chain");
export type ChainId = typeof ChainId.Type;

const StatementId = id("Statement");
type StatementId = typeof StatementId.Type;

const TransactionId = id("Transaction");
export type TransactionId = typeof TransactionId.Type;

const TxStatus = union("pending", "confirmed", "failed");
export type TxStatus = typeof TxStatus.Type;

const KeyType = union("evm", "tron", "btc", "solana");
export type KeyType = typeof KeyType.Type;

const Origin = union("imported", "derived", "watchOnly");
export type Origin = typeof Origin.Type;

const TokenBalanceId = id("TokenBalance");
export type TokenBalanceId = typeof TokenBalanceId.Type;

const DerivationCounterId = id("DerivationCounter");
export type DerivationCounterId = typeof DerivationCounterId.Type;

// Local-only cache tables (prefixed with _ to prevent sync)
const BalanceCacheId = id("_BalanceCache");
export type BalanceCacheId = typeof BalanceCacheId.Type;

const TokenBalanceCacheId = id("_TokenBalanceCache");
export type TokenBalanceCacheId = typeof TokenBalanceCacheId.Type;

const PriceCacheId = id("_PriceCache");
export type PriceCacheId = typeof PriceCacheId.Type;

const TokenMetadataCacheId = id("_TokenMetadataCache");
export type TokenMetadataCacheId = typeof TokenMetadataCacheId.Type;

export const Schema = {
	eoa: {
		id: EoaId,
		address: NonEmptyString1000,
		isSelected: nullOr(SqliteBoolean),
		encryptedPrivateKey: nullOr(NonEmptyString1000),
		keyType: nullOr(KeyType),
		origin: nullOr(Origin),
		derivationIndex: nullOr(FiniteNumber),
	},
	chain: {
		id: ChainId,
		name: NonEmptyString100,
	},
	statement: {
		id: StatementId,
		eoaId: EoaId,
		chainId: ChainId,
		amount: FiniteNumber,
		currency: NonEmptyString100,
		timestamp: DateIso,
	},
	transaction: {
		id: TransactionId,
		walletId: EoaId,
		txHash: NonEmptyString100,
		from: NonEmptyString1000,
		to: NonEmptyString1000,
		value: NonEmptyString1000,
		gasUsed: nullOr(NonEmptyString100),
		maxFeePerGas: NonEmptyString100,
		chainId: NonEmptyString100,
		status: TxStatus,
		confirmedAt: nullOr(DateIso),
	},
	tokenBalance: {
		id: TokenBalanceId,
		eoaId: EoaId,
		tokenAddress: NonEmptyString1000,
		chainId: ChainId,
		balance: NonEmptyString1000,
	},
	derivationCounter: {
		id: DerivationCounterId,
		keyType: KeyType,
		nextIndex: FiniteNumber,
	},

	// Local-only cache tables (prefixed with _ to prevent sync to relay)
	// These store stale-while-revalidate data that persists across app reloads

	/** Native balance cache (ETH, TRX, etc.) - local-only, never synced */
	_balanceCache: {
		id: BalanceCacheId,
		address: NonEmptyString1000, // wallet address (checksummed)
		chainId: NonEmptyString100, // "1" | "8453" | "tron"
		balanceRaw: NonEmptyString1000, // raw balance as string (for BigInt)
		// updatedAt is auto-added by Evolu system columns
	},

	/** Token balance cache (ERC20, TRC20) - local-only, never synced */
	_tokenBalanceCache: {
		id: TokenBalanceCacheId,
		address: NonEmptyString1000, // wallet address
		tokenAddress: NonEmptyString1000, // token contract address
		chainId: NonEmptyString100, // "1" | "8453" | "tron"
		balanceRaw: NonEmptyString1000, // raw balance as string
	},

	/** Price cache (CoinGecko prices) - local-only, never synced */
	_priceCache: {
		id: PriceCacheId,
		coinId: NonEmptyString100, // "ethereum", "tron", "usd-coin", etc.
		priceUsd: FiniteNumber, // USD price
	},

	/** Token metadata cache (logos from CoinGecko) - local-only, never synced */
	_tokenMetadataCache: {
		id: TokenMetadataCacheId,
		coinId: NonEmptyString100, // "ethereum", "tron", "usd-coin", etc.
		name: NonEmptyString100, // token name
		symbol: NonEmptyString100, // token symbol
		imageThumb: NonEmptyString1000, // 64x64 image URL
		imageSmall: NonEmptyString1000, // 128x128 image URL
		imageLarge: NonEmptyString1000, // 512x512 image URL
	},
};

// Derive insert types from Schema (exclude auto-generated fields like id)
// Extract the runtime types from Evolu's branded types
export type EoaInsert = {
	address: string;
	isSelected: 0 | 1 | null;
	encryptedPrivateKey: string | null;
	keyType: "evm" | "tron" | "btc" | "solana" | null;
	origin: "imported" | "derived" | "watchOnly" | null;
	derivationIndex: number | null;
};

// Transaction insert type
export type TransactionInsert = {
	walletId: string;
	txHash: string;
	from: string;
	to: string;
	value: string;
	gasUsed: string | null;
	maxFeePerGas: string;
	chainId: string;
	status: "pending" | "confirmed" | "failed";
	confirmedAt: string | null;
};

// a type to be used in a view
export type Statement = {
	id: StatementId;
	eoaId: EoaId;
	chainId: ChainId;
	amount: FiniteNumber;
	currency: NonEmptyString100;
	timestamp: DateIso;
};

// TokenBalance insert type
export type TokenBalanceInsert = {
	eoaId: string;
	tokenAddress: string;
	chainId: string;
	balance: string;
	updatedAt: string;
};

// DerivationCounter insert type
export type DerivationCounterInsert = {
	keyType: "evm" | "tron" | "btc" | "solana";
	nextIndex: number;
};

// BalanceCache insert type (local-only)
export type BalanceCacheInsert = {
	address: string;
	chainId: string;
	balanceRaw: string;
};

// TokenBalanceCache insert type (local-only)
export type TokenBalanceCacheInsert = {
	address: string;
	tokenAddress: string;
	chainId: string;
	balanceRaw: string;
};

// PriceCache insert type (local-only)
export type PriceCacheInsert = {
	coinId: string;
	priceUsd: number;
};

// TokenMetadataCache insert type (local-only)
export type TokenMetadataCacheInsert = {
	coinId: string;
	name: string;
	symbol: string;
	imageThumb: string;
	imageSmall: string;
	imageLarge: string;
};
