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

const KeyType = union("evm", "tron", "btc", "solana");
export type KeyType = typeof KeyType.Type;

const Origin = union("imported", "derived");
export type Origin = typeof Origin.Type;

export const Schema = {
	eoa: {
		id: EoaId,
		address: NonEmptyString1000,
		isSelected: nullOr(SqliteBoolean),
		unencryptedPrivateKey: nullOr(NonEmptyString1000),
		keyType: nullOr(KeyType),
		origin: nullOr(Origin),
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
};

// Derive insert types from Schema (exclude auto-generated fields like id)
// Extract the runtime types from Evolu's branded types
export type EoaInsert = {
	address: string;
	isSelected: 0 | 1 | null;
	unencryptedPrivateKey: string | null;
	keyType: "evm" | "tron" | "btc" | "solana" | null;
	origin: "imported" | "derived" | null;
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
