export interface AppName {
	name: string;
}

export type SupportedChainId = 1 | 8453;

export interface BalanceRequest {
	address: string;
	chainId: SupportedChainId;
}

export type BalanceErrorCode =
	| "INVALID_ADDRESS"
	| "INVALID_CHAIN"
	| "API_ERROR"
	| "RATE_LIMITED";

export interface BalanceSuccess {
	ok: true;
	address: string;
	chainId: SupportedChainId;
	balanceWei: string;
	balanceEth: string;
	timestamp: number;
}

export interface BalanceError {
	ok: false;
	error: string;
	code: BalanceErrorCode;
}

export type BalanceResult = BalanceSuccess | BalanceError;
