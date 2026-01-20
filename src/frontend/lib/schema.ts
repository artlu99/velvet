import {
	DateIso,
	FiniteNumber,
	id,
    NonEmptyString100,
	NonEmptyString1000,
	nullOr,
	SqliteBoolean,
} from "@evolu/common";

const EoaId = id("Eoa");
export type EoaId = typeof EoaId.Type;

const ChainId = id("Chain");
export type ChainId = typeof ChainId.Type;

const StatementId = id("Statement");
type StatementId = typeof StatementId.Type;

export const Schema = {
	eoa: {
		id: EoaId,
		address: NonEmptyString1000,
		isSelected: nullOr(SqliteBoolean),
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

// a type to be used in a view
export type Statement = {
	id: StatementId;
	eoaId: EoaId;
	chainId: ChainId;
	amount: FiniteNumber;
	currency: NonEmptyString100;
	timestamp: DateIso;
};