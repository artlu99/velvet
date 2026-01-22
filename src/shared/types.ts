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

// Gas estimation types
export interface GasEstimateRequest {
	from: string;
	to: string;
	value: string; // wei
	chainId: SupportedChainId;
}

export type GasEstimateResult = GasEstimateSuccess | GasEstimateError;

export interface GasEstimateSuccess {
	readonly ok: true;
	readonly gasLimit: string;
	readonly maxFeePerGas: string;
	readonly maxPriorityFeePerGas: string;
	readonly totalCostEth: string;
}

export interface GasEstimateError {
	readonly ok: false;
	readonly error: string;
	readonly code: GasErrorCode;
}

export type GasErrorCode =
	| "INVALID_ADDRESS"
	| "INSUFFICIENT_BALANCE"
	| "NETWORK_ERROR";

// Send transaction types
export interface SendTransactionRequest {
	walletId: string;
	to: string;
	value: string;
	gasLimit: string;
	maxFeePerGas: string;
	maxPriorityFeePerGas: string;
	chainId: SupportedChainId;
}

export type SendTransactionResult =
	| SendTransactionSuccess
	| SendTransactionError;

export interface SendTransactionSuccess {
	readonly ok: true;
	readonly txHash: string;
	readonly from: string;
	readonly to: string;
	readonly value: string;
}

export interface SendTransactionError {
	readonly ok: false;
	readonly error: string;
	readonly code: SendErrorCode;
}

export type SendErrorCode =
	| "INVALID_RECIPIENT"
	| "INSUFFICIENT_BALANCE"
	| "SIGNING_FAILED"
	| "BROADCAST_FAILED";

// Broadcast signed transaction types (frontend signs, backend broadcasts)
export interface BroadcastTransactionRequest {
	signedTransaction: string;
	chainId: SupportedChainId;
}

export type BroadcastTransactionResult =
	| BroadcastTransactionSuccess
	| BroadcastTransactionError;

export interface BroadcastTransactionSuccess {
	readonly ok: true;
	readonly txHash: string;
}

export interface BroadcastTransactionError {
	readonly ok: false;
	readonly error: string;
	readonly code: BroadcastErrorCode;
}

export type BroadcastErrorCode = "INVALID_TRANSACTION" | "BROADCAST_FAILED";

// Transaction count types
export interface TransactionCountRequest {
	address: string;
	chainId: SupportedChainId;
}

export type TransactionCountResult =
	| TransactionCountSuccess
	| TransactionCountError;

export interface TransactionCountSuccess {
	readonly ok: true;
	readonly nonce: number;
}

export interface TransactionCountError {
	readonly ok: false;
	readonly error: string;
	readonly code: "INVALID_ADDRESS" | "INVALID_CHAIN" | "NETWORK_ERROR";
}

// ERC20 Balance types
export interface Erc20BalanceRequest {
	address: string;
	contract: string;
	chainId: SupportedChainId;
}

export interface Erc20BalanceSuccess {
	ok: true;
	address: string;
	contract: string;
	symbol: string;
	decimals: number;
	balanceRaw: string;
	balanceFormatted: string;
	timestamp: number;
}

export interface Erc20BalanceError {
	ok: false;
	error: string;
	code: BalanceErrorCode;
}

export type Erc20BalanceResult = Erc20BalanceSuccess | Erc20BalanceError;

// ERC20 Gas Estimation types
export interface Erc20GasEstimateRequest {
	from: string;
	to: string;
	contract: string;
	amount: string; // Raw amount in smallest unit
	chainId: SupportedChainId;
}

export type Erc20GasEstimateResult = GasEstimateSuccess | GasEstimateError;

// ENS Name types
export interface EnsNameRequest {
	address: string;
}

export interface EnsNameSuccess {
	ok: true;
	address: string;
	ensName: string | null;
	timestamp: number;
}

export interface EnsNameError {
	ok: false;
	error: string;
	code: "INVALID_ADDRESS" | "NETWORK_ERROR";
}

export type EnsNameResult = EnsNameSuccess | EnsNameError;
