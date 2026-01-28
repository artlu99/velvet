export interface AppName {
	name: string;
}

export type SupportedChainId = 1 | 8453 | "tron";

// Discriminated union mapping keyType to supported chains
// This ensures type safety - Tron wallets can only use Tron chains, EVM wallets only EVM chains
export type KeyType = "evm" | "tron" | "btc" | "solana";

export type EvmChainId = 1 | 8453; // Ethereum, Base
export type TronChainId = "tron";

// Maps wallet keyType to its supported chain IDs
export type KeyTypeToChainId = {
	evm: EvmChainId;
	tron: TronChainId;
	btc: never; // Not yet supported
	solana: never; // Not yet supported
};

// Type guard to check if a chainId is valid for a given keyType
export function isValidChainForKeyType<T extends KeyType>(
	keyType: T,
	chainId: SupportedChainId,
): chainId is KeyTypeToChainId[T] {
	if (keyType === "evm") {
		return chainId === 1 || chainId === 8453;
	}
	if (keyType === "tron") {
		return chainId === "tron";
	}
	return false;
}

// Get all supported chain IDs for a keyType
export function getSupportedChainsForKeyType(
	keyType: KeyType,
): SupportedChainId[] {
	if (keyType === "evm") {
		return [1, 8453];
	}
	if (keyType === "tron") {
		return ["tron"];
	}
	return [];
}

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

// ENS Address Resolution types (forward lookup: name -> address)
export interface EnsAddressSuccess {
	ok: true;
	name: string;
	address: string;
	timestamp: number;
}

export interface EnsAddressError {
	ok: false;
	error: string;
	code: "INVALID_NAME" | "NAME_NOT_FOUND" | "NETWORK_ERROR";
}

export type EnsAddressResult = EnsAddressSuccess | EnsAddressError;

// Basename types (reverse lookup: address -> basename on Base L2)
export interface BasenameSuccess {
	ok: true;
	address: string;
	basename: string | null;
	timestamp: number;
}

export type BasenameResult = BasenameSuccess | EnsNameError;

// Basename Address Resolution types (forward lookup: name -> address)
export interface BasenameAddressSuccess {
	ok: true;
	name: string;
	address: string;
	timestamp: number;
}

export type BasenameAddressResult = BasenameAddressSuccess | EnsAddressError;

// Tron Balance types
export interface TronBalanceRequest {
	address: string;
}

export interface TronBalanceSuccess {
	readonly ok: true;
	readonly address: string;
	readonly balanceTrx: string;
	readonly balanceSun: string;
	readonly bandwidth: { free: number; used: number };
	readonly energy: { free: number; used: number };
	readonly timestamp: number;
}

export interface TronBalanceError {
	readonly ok: false;
	readonly error: string;
	readonly code: "INVALID_TRON_ADDRESS" | "NETWORK_ERROR";
}

export type TronBalanceResult = TronBalanceSuccess | TronBalanceError;

// TRC20 Balance types
export interface Trc20BalanceRequest {
	address: string;
	contract: string;
}

export interface Trc20BalanceSuccess {
	readonly ok: true;
	readonly address: string;
	readonly contract: string;
	readonly symbol: string;
	readonly decimals: number;
	readonly balanceRaw: string;
	readonly balanceFormatted: string;
	readonly timestamp: number;
}

export interface Trc20BalanceError {
	readonly ok: false;
	readonly error: string;
	readonly code: "INVALID_TRON_ADDRESS" | "INVALID_CONTRACT" | "NETWORK_ERROR";
}

export type Trc20BalanceResult = Trc20BalanceSuccess | Trc20BalanceError;

// Tron Gas Estimation types
export interface TronGasEstimateRequest {
	from: string;
	to: string;
	contract: string;
	amount: string;
}

export interface TronGasEstimateSuccess {
	readonly ok: true;
	readonly bandwidthRequired: number;
	readonly energyRequired: number;
	readonly energyFee: string;
	readonly totalCostTrx: string;
}

export interface TronGasEstimateError {
	readonly ok: false;
	readonly error: string;
	readonly code:
		| "INSUFFICIENT_BANDWIDTH"
		| "INSUFFICIENT_ENERGY"
		| "NETWORK_ERROR";
}

export type TronGasEstimateResult =
	| TronGasEstimateSuccess
	| TronGasEstimateError;

// Tron Broadcast types
export interface TronBroadcastRequest {
	signedTransaction: string;
}

export interface TronBroadcastSuccess {
	readonly ok: true;
	readonly txHash: string;
}

export interface TronBroadcastError {
	readonly ok: false;
	readonly error: string;
	readonly code: "INVALID_TRANSACTION" | "BROADCAST_FAILED";
}

export type TronBroadcastResult = TronBroadcastSuccess | TronBroadcastError;

// CoinGecko Price types
export interface CoinGeckoPriceMap {
	[coinId: string]: { usd: number };
}

export interface PricesSuccess {
	readonly ok: true;
	readonly prices: CoinGeckoPriceMap;
	readonly timestamp: number;
}

export interface PricesError {
	readonly ok: false;
	readonly error: string;
	readonly code: "RATE_LIMITED" | "API_ERROR";
}

export type PricesResult = PricesSuccess | PricesError;

// Token Metadata types (for logos and chain info)
export interface TokenMetadataImage {
	readonly thumb: string; // 64x64
	readonly small: string; // 128x128
	readonly large: string; // 512x512
}

export interface TokenMetadata {
	readonly id: string;
	readonly name: string;
	readonly symbol: string;
	readonly image: TokenMetadataImage;
}

export type TokenMetadataMap = Record<string, TokenMetadata>;

export interface TokenMetadataSuccess {
	readonly ok: true;
	readonly tokens: TokenMetadataMap;
	readonly timestamp: number;
}

export interface TokenMetadataError {
	readonly ok: false;
	readonly error: string;
	readonly code: "RATE_LIMITED" | "API_ERROR";
}

export type TokenMetadataResult = TokenMetadataSuccess | TokenMetadataError;

// Platform/Chain Metadata types (for chain logos)
export interface PlatformMetadataImage {
	readonly thumb: string; // 64x64
	readonly small: string; // 128x128
	readonly large: string; // 512x512
}

export interface PlatformMetadata {
	readonly id: string; // Platform ID (e.g., "ethereum", "base", "tron")
	readonly chainIdentifier: string;
	readonly name: string;
	readonly shortname: string;
	readonly image: PlatformMetadataImage;
}

export interface PlatformMetadataSuccess {
	readonly ok: true;
	readonly platforms: PlatformMetadata[];
	readonly timestamp: number;
}

export interface PlatformMetadataError {
	readonly ok: false;
	readonly error: string;
	readonly code: "RATE_LIMITED" | "API_ERROR";
}

export type PlatformMetadataResult =
	| PlatformMetadataSuccess
	| PlatformMetadataError;

// Transaction Receipt types
export interface TransactionReceiptSuccess {
	ok: true;
	txHash: string;
	status: "success" | "reverted";
	gasUsed: string;
	blockNumber: string;
	blockTimestamp: number | null;
}

export interface TransactionReceiptError {
	ok: false;
	error: string;
	code: "INVALID_TRANSACTION" | "NETWORK_ERROR" | "NOT_FOUND";
}

export type TransactionReceiptResult =
	| TransactionReceiptSuccess
	| TransactionReceiptError;
