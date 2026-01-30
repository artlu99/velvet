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

export const Schema = {
	eoa: {
		id: EoaId,
		address: NonEmptyString1000,
		isSelected: nullOr(SqliteBoolean),
		encryptedPrivateKey: nullOr(NonEmptyString1000),
		keyType: nullOr(KeyType),
		origin: nullOr(Origin),
		derivationIndex: nullOr(FiniteNumber),
		orderIndex: nullOr(FiniteNumber),
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
	derivationCounter: {
		id: DerivationCounterId,
		keyType: KeyType,
		nextIndex: FiniteNumber,
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
	orderIndex: number | null;
};

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

export type DerivationCounterInsert = {
	keyType: "evm" | "tron" | "btc" | "solana";
	nextIndex: number;
};
