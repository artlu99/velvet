# Solana Support Implementation Plan

**this is a WIP planning document, generated for <$1 in inference costs across multiple frontier models in Jan 2026. As they continue to differ on their opinions, rather than converging on details of the solution, we are punting this until later for now**

## Goal

Add direct, simple Solana (SOL) and USDC support targeting **Mainnet-beta**.

- **Network**: Mainnet-beta only
- **Address Format**: Base58-encoded Ed25519 public keys
- **Architecture**: Client-side signing (`@solana/web3.js`) + Backend proxy to RPC endpoints

## Scope & Limitations

| Aspect | Decision |
|--------|----------|
| Key Type | Ed25519 (NOT secp256k1 like EVM/Tron) |
| Derivation Path | `m/44'/501'/0'/0'/0'` for account 0 (full BIP44: account/change/address) |
| Token Standard | SPL tokens (USDC only initially; Token-2022 not yet supported) |
| ATAs | Associated Token Accounts created automatically if recipient doesn't have one (UI warning shown) |
| Fees | Priority fee estimation from RPC (median of recent fees); upper bound enforced |
| Change Addresses | None needed (account model, not UTXO) |
| Minimum Balance | Always maintain rent-exempt minimum (~0.001 SOL) |

## 1. Shared Types (`src/shared/types.ts`)

Add `solana` to the discriminated unions.

```typescript
export type SupportedChainId = 1 | 8453 | "tron" | "solana";

export type SolanaChainId = "solana";

export type KeyTypeToChainId = {
  evm: EvmChainId;
  tron: TronChainId;
  btc: never; // Not yet supported
  solana: SolanaChainId;
};

// Solana Balance types
export interface SolanaBalanceRequest {
  address: string;
}

export interface SolanaBalanceSuccess {
  readonly ok: true;
  readonly address: string;
  readonly balanceLamports: string;
  readonly balanceSol: string;
  readonly timestamp: number;
}

export interface SolanaBalanceError {
  readonly ok: false;
  readonly error: string;
  readonly code: "INVALID_SOLANA_ADDRESS" | "NETWORK_ERROR";
}

export type SolanaBalanceResult = SolanaBalanceSuccess | SolanaBalanceError;

// SPL Token Balance types
export interface SplTokenBalanceRequest {
  address: string;
  mint: string; // SPL token mint address
}

export interface SplTokenBalanceSuccess {
  readonly ok: true;
  readonly address: string;
  readonly mint: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly balanceRaw: string;
  readonly balanceFormatted: string;
  readonly ataAddress: string | null; // Associated Token Account address (null if none)
  readonly timestamp: number;
}

export interface SplTokenBalanceError {
  readonly ok: false;
  readonly error: string;
  readonly code: "INVALID_SOLANA_ADDRESS" | "INVALID_MINT" | "NO_TOKEN_ACCOUNT" | "NETWORK_ERROR";
}

export type SplTokenBalanceResult = SplTokenBalanceSuccess | SplTokenBalanceError;

// Solana Fee Estimation types
export interface SolanaFeeEstimateRequest {
  from: string;
  to: string;
  amount: string; // lamports for SOL, raw amount for SPL
  mint?: string; // Optional: SPL token mint (if not provided, native SOL transfer)
}

export interface SolanaFeeEstimateSuccess {
  readonly ok: true;
  readonly baseFee: string; // lamports (5000 base)
  readonly priorityFee: string; // lamports
  readonly rentExemption: string; // lamports (only if ATA creation needed)
  readonly totalFeeLamports: string;
  readonly totalFeeSol: string;
  readonly requiresAtaCreation: boolean;
}

export interface SolanaFeeEstimateError {
  readonly ok: false;
  readonly error: string;
  readonly code: "INVALID_ADDRESS" | "INSUFFICIENT_BALANCE" | "NETWORK_ERROR" | "MINT_NOT_FOUND" | "ATA_CREATION_FAILED";
}

export type SolanaFeeEstimateResult = SolanaFeeEstimateSuccess | SolanaFeeEstimateError;

// Solana Broadcast types
export interface SolanaBroadcastRequest {
  signedTransaction: string; // Base64-encoded signed transaction
}

export interface SolanaBroadcastSuccess {
  readonly ok: true;
  readonly signature: string; // Transaction signature
}

export interface SolanaBroadcastError {
  readonly ok: false;
  readonly error: string;
  readonly code: "INVALID_TRANSACTION" | "SIMULATION_FAILED" | "BROADCAST_FAILED" | "BLOCKHASH_EXPIRED";
}

export type SolanaBroadcastResult = SolanaBroadcastSuccess | SolanaBroadcastError;

// Solana Blockhash types
export interface SolanaBlockhashRequest {}

export interface SolanaBlockhashSuccess {
  readonly ok: true;
  readonly blockhash: string;
  readonly lastValidBlockHeight: number;
  readonly timestamp: number; // For client-side expiry validation
}

export interface SolanaBlockhashError {
  readonly ok: false;
  readonly error: string;
  readonly code: "NETWORK_ERROR";
}

export type SolanaBlockhashResult = SolanaBlockhashSuccess | SolanaBlockhashError;
```

## 2. Backend (`src/backend/`)

Proxy Solana RPC to handle CORS/Caching and abstract RPC providers.

### 2.1 RPC Client (`src/backend/lib/solana/rpc.ts`)

| Function | RPC Method | Purpose |
|----------|-----------|---------|
| `getSolanaBalance(address)` | `getBalance` | Native SOL balance |
| `getSplTokenBalance(address, mint)` | `getTokenAccountsByOwner` | SPL token balance + ATA address (filtered by mint) |
| `getRecentBlockhash()` | `getLatestBlockhash` | Transaction building (returns blockhash + timestamp) |
| `getRentExemption(dataLength)` | `getMinimumBalanceForRentExemption` | Dynamic rent calculation for ATAs |
| `getPriorityFee()` | `getRecentPrioritizationFees` | Fee estimation (returns median of recent fees) |
| `checkAtaExists(owner, mint)` | `getAccountInfo` | Check if ATA exists |
| `simulateTransaction(tx)` | `simulateTransaction` | Pre-broadcast validation (10s timeout) |
| `broadcastSolanaTransaction(signedTx)` | `sendTransaction` | Broadcast signed tx |
| `getTransactionStatus(signature)` | `getSignatureStatuses` | Poll transaction confirmation |

### 2.2 Routes (`src/backend/index.ts`)

| Route | Method | Cache TTL | Notes |
|-------|--------|-----------|-------|
| `/balance/solana/:address` | GET | 60s | |
| `/balance/spl/:address/:mint` | GET | 60s | |
| `/blockhash/solana` | GET | None | Returns blockhash + timestamp for expiry validation |
| `/priority-fee/solana` | GET | 10s | Returns median of recent prioritization fees |
| `/ata-exists/solana/:owner/:mint` | GET | None | |
| `/rent-exemption/solana/:dataLength` | GET | 3600s | Dynamic rent calculation |
| `/estimate-gas/solana` | POST | None | |
| `/broadcast-transaction/solana` | POST | None | |
| `/transaction-status/solana/:signature` | GET | None | For polling confirmation |

### 2.3 RPC Configuration

```typescript
// Primary: Helius or Quicknode (if API key available)
// Fallback: Public RPC endpoints (rate limited)
// Retry strategy: Round-robin with exponential backoff (max 3 retries per endpoint)
const SOLANA_RPC_URLS = [
  env.HELIUS_RPC_URL,
  env.QUICKNODE_RPC_URL,
  "https://api.mainnet-beta.solana.com",
];

// Timeout per RPC call: 10 seconds
const RPC_TIMEOUT_MS = 10_000;
```

## 3. Frontend Logic (`src/frontend/lib/`)

### 3.1 Dependencies

```json
{
  "dependencies": {
    "@solana/web3.js": "^1.95.0",
    "@solana/spl-token": "^0.4.0",
    "ed25519-hd-key": "^1.3.0"
  }
}
```

Note: `@scure/bip32` and `@scure/bip39` already present in project.

### 3.2 Key Derivation (`src/frontend/lib/bip32.ts`)

```typescript
import { Keypair } from "@solana/web3.js";
import { derivePath } from "ed25519-hd-key";
import { mnemonicToSeedSync } from "@scure/bip39";

/**
 * Derives Solana keypair from mnemonic using BIP44 path
 * Path format: m/44'/501'/${accountIndex}'/0'/0'
 * - 44' = BIP44 purpose
 * - 501' = Solana coin type (SLIP-0048)
 * - ${accountIndex}' = Account number (hardened)
 * - 0' = Change (hardened, always external for Solana)
 * - 0' = Address index (hardened, first address)
 *
 * @param mnemonic - BIP39 mnemonic phrase (12-24 words)
 * @param accountIndex - Account index (>= 0). First account is 0
 * @param passphrase - Optional BIP39 passphrase (for consistency with EVM derivation)
 * @returns Public key (Base58) and secret key (Uint8Array)
 */
export function deriveSolanaKeyFromMnemonic(
  mnemonic: string,
  accountIndex: number = 0,
  passphrase: string = ""
): { publicKey: string; secretKey: Uint8Array } {
  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  // Full BIP44 path for Solana: m/44'/501'/${account}'/0'/0'
  // Example: m/44'/501'/0'/0'/0' for first account
  //          m/44'/501'/1'/0'/0' for second account
  const path = `m/44'/501'/${accountIndex}'/0'/0'`;
  const { key } = derivePath(path, Buffer.from(seed).toString("hex"));
  const keypair = Keypair.fromSeed(key);

  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: keypair.secretKey,
  };
}
```

### 3.3 Solana Lib (`src/frontend/lib/solana.ts`)

```typescript
/**
 * Validates a Solana base58-encoded public key
 */
export function isValidSolanaAddress(address: string): boolean;

/**
 * Validates a Solana SPL token mint address
 */
export function isValidSolanaMint(mint: string): boolean;

/**
 * Gets the associated token account address for a wallet and mint
 */
export function getAssociatedTokenAddress(
  walletAddress: string,
  mintAddress: string
): Promise<string>;

/**
 * Builds native SOL transfer transaction
 * Includes compute unit instructions for priority fees
 */
export function buildSolTransfer(
  from: string,
  to: string,
  lamports: string,
  recentBlockhash: string,
  priorityFeeLamports?: string
): Transaction;

/**
 * Builds SPL token transfer transaction (includes ATA creation if needed)
 * Includes compute unit instructions for priority fees
 */
export function buildSplTransfer(
  from: string,
  to: string,
  mint: string,
  amount: string,
  decimals: number,
  recentBlockhash: string,
  createAta: boolean,
  priorityFeeLamports?: string
): Transaction;

/**
 * Signs transaction with Ed25519 key
 */
export function signTransaction(
  transaction: Transaction,
  secretKey: Uint8Array
): Transaction;

/**
 * Serializes signed transaction to Base64 for broadcast
 */
export function serializeTransaction(signedTx: Transaction): string;

/**
 * Validates blockhash hasn't expired (< 60 seconds old)
 */
export function isBlockhashValid(blockhashTimestamp: number): boolean;
```

## 4. Frontend UI

### 4.1 Hooks

**Query Hooks** (`src/frontend/hooks/queries/`):
- `useSolanaBalanceQuery(address)` → Native SOL balance
- `useSplTokenBalanceQuery(address, mint)` → SPL token balance (USDC)
- `useSolanaBlockhashQuery()` → Recent blockhash + timestamp for tx building
- `useSolanaPriorityFeeQuery()` → Priority fee estimation (median)
- `useTransactionStatusQuery(signature)` → Poll transaction confirmation status

**Mutation Hooks** (`src/frontend/hooks/mutations/`):
- `useEstimateSolanaGasMutation()` → Gas/fee estimation
- `useBroadcastSolanaTransactionMutation()` → Broadcast signed transaction

### 4.2 Components

**WalletBalance**:
- Add SOL/USDC display cards

**SendForm**:
- Detect Solana address type (Base58, ~32-44 chars)
- Fetch blockhash and priority fee on mount
- Validate blockhash age before signing (< 60 seconds)
- Check if ATA exists for SPL transfers
- Show warning when ATA creation is required (user pays ~0.002 SOL)
- Handle ATA creation cost in fee display
- Enforce minimum balance: `MIN_ACCOUNT_BALANCE_LAMPORTS` (~0.001 SOL must remain)
- Calculate max spendable: `Balance - Fee - RentExemption(if ATA) - MIN_ACCOUNT_BALANCE`
- Simulate transaction before signing (catch errors early)
- Sign & Broadcast
- Poll transaction status until confirmed/finalized

**Explorer Links**:
- Transaction: `https://solscan.io/tx/{signature}`
- Account: `https://solscan.io/account/{address}`

### 4.3 Token Configuration

```typescript
// USDC on Solana Mainnet
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;
export const USDC_COINGECKO_ID = "usd-coin";
```

## 5. Implementation Phases

### Phase 1: Read-Only (Balance Viewing)
1. Add Solana types to `src/shared/types.ts`
2. Implement backend RPC client (`src/backend/lib/solana/rpc.ts`)
3. Add balance endpoints to backend
4. Implement key derivation for Solana (Ed25519)
5. Add `useSolanaBalanceQuery` and `useSplTokenBalanceQuery` hooks
6. Display SOL/USDC balances in UI

### Phase 2: Send SOL
1. Implement transaction building (`buildSolTransfer`)
2. Implement transaction signing
3. Add simulation endpoint
4. Add broadcast endpoint and mutation hook
5. Update SendForm for Solana native transfers

### Phase 3: Send USDC
1. Implement ATA derivation and existence check
2. Implement `buildSplTransfer` with ATA creation if needed
3. Handle rent exemption in fee estimation
4. Update SendForm for SPL token transfers

## 6. Constants

```typescript
// Solana Constants
const LAMPORTS_PER_SOL = 1_000_000_000; // 10^9
const BASE_FEE_LAMPORTS = 5000; // 5000 lamports base fee per signature

// Rent Exemption (fetch dynamically via RPC, these are fallbacks)
const TOKEN_ACCOUNT_RENT_LAMPORTS_FALLBACK = 2039280; // ~0.00203928 SOL for ATA creation
const SYSTEM_ACCOUNT_RENT_LAMPORTS_FALLBACK = 890880; // ~0.00089 SOL for system accounts

// Account Minimums
const MIN_ACCOUNT_BALANCE_LAMPORTS = 1_000_000; // Minimum ~0.001 SOL to keep account operational

// Fee Limits
const MAX_PRIORITY_FEE_LAMPORTS = 10_000_000; // Max 0.01 SOL for priority fee (safety limit)
const PRIORITY_FEE_PERCENTILE = 50; // Use median (50th percentile) of recent fees

// Blockhash
const BLOCKHASH_MAX_AGE_MS = 60_000; // 60 seconds - refresh if older

// Compute Units
const COMPUTE_UNIT_LIMIT_SOL_TRANSFER = 200_000; // Sufficient for SOL transfer
const COMPUTE_UNIT_LIMIT_SPL_TRANSFER = 300_000; // Sufficient for SPL transfer + ATA creation

// BIP44 Derivation Path (full format: m/44'/501'/${account}'/0'/0')
const SOLANA_DERIVATION_PATH_TEMPLATE = "m/44'/501'/0'/0'/0'"; // Account 0, change 0, address 0

// RPC Methods
const RPC_METHODS = {
  getBalance: "getBalance",
  getTokenAccountsByOwner: "getTokenAccountsByOwner",
  getLatestBlockhash: "getLatestBlockhash", // Replaces deprecated getRecentBlockhash
  getRecentPrioritizationFees: "getRecentPrioritizationFees",
  getMinimumBalanceForRentExemption: "getMinimumBalanceForRentExemption",
  sendTransaction: "sendTransaction",
  simulateTransaction: "simulateTransaction",
  getSignatureStatuses: "getSignatureStatuses",
};

// Commitment Levels
const COMMITMENT = {
  balance: "confirmed",
  tokenAccounts: "confirmed",
  broadcast: "confirmed",
  simulation: "processed",
};
```

## 7. Environment Variables

Add to `.dev.vars.example` and `wrangler.jsonc`:

```bash
# Solana RPC (optional, defaults to public endpoint)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
QUICKNODE_RPC_URL=https://YOUR_ENDPOINT.quiknode.pro/YOUR_KEY/
```

## 8. Security Checklist

1. **Private Keys**: Ed25519 secret keys never leave client-side (`bip32.ts`, `solana.ts`)
2. **Rent Exemption**: Fetch rent exemption dynamically via `getMinimumBalanceForRentExemption`; use fallback only if RPC fails
3. **Minimum Balance**: Always enforce `MIN_ACCOUNT_BALANCE_LAMPORTS` (~0.001 SOL) to keep account operational
4. **Validation**: Validate Base58 address format AND mint addresses before any operation
5. **Simulation**: Use `simulateTransaction` (with 10s timeout) before broadcast to catch errors early
6. **Blockhash Expiry**: Blockhashes expire after ~150 blocks (~75 seconds); validate age < 60s before signing
7. **ATA Safety**: Always use Associated Token Accounts for SPL transfers to avoid loss of funds
8. **ATA Creation Warning**: Show explicit UI warning when ATA creation required (sender pays ~0.002 SOL) to prevent economic drain attacks
9. **Fee Bounds**: Enforce `MAX_PRIORITY_FEE_LAMPORTS` upper bound to avoid excessive fees during congestion
10. **Priority Fee Calculation**: Use median (50th percentile) of `getRecentPrioritizationFees` array
11. **Compute Units**: Set appropriate compute unit limits to avoid transaction failures
12. **RPC Fallback**: Implement round-robin retry with exponential backoff across multiple RPC endpoints
13. **Transaction Confirmation**: Poll `getSignatureStatuses` until confirmed/finalized; handle timeouts gracefully

## 9. Differences from EVM/Tron

| Aspect | EVM/Tron | Solana |
|--------|----------|--------|
| Key Type | secp256k1 | Ed25519 |
| Address Format | Hex (0x...) / Base58check (T...) | Base58 |
| Token Standard | ERC20/TRC20 | SPL |
| Token Accounts | Implicit | Explicit ATAs |
| Fee Model | Gas price × Gas used | Base fee + Priority fee |
| Transaction Model | Single call | Multiple instructions |
| Nonce | Sequential integer | Recent blockhash |

## 10. Test Plan

**Unit Tests**:
- Address validation (valid/invalid Base58)
- Mint address validation
- Key derivation from mnemonic (with and without passphrase)
- Transaction serialization
- Blockhash age validation

**Integration Tests**:
- SOL transfer happy path (mock RPC)
- USDC transfer + ATA creation
- Invalid recipient address handling
- Simulation failure scenarios
- RPC fallback behavior

**Edge Cases**:
- Sending to address without token account (ATA creation)
- Sending entire balance (should be blocked - must maintain MIN_ACCOUNT_BALANCE)
- Stale blockhash (> 60 seconds) - should refresh before signing
- Transaction timeout/retry scenarios
- Priority fee spike (should reject if exceeds MAX_PRIORITY_FEE_LAMPORTS)
- RPC endpoint failures (fallback logic)
- Transaction confirmation delays (polling logic)

## 11. Known Limitations & Future Considerations

1. **Token-2022 Program**: Initial implementation supports only the original SPL Token program. Token Extensions (Token-2022) support can be added later.

2. **Token Metadata**: Only USDC metadata is hardcoded initially. Future: Implement dynamic token metadata fetching from Token Metadata Program or external APIs.

3. **Compute Budget**: Fixed compute unit limits per transaction type. Future: Dynamic calculation based on transaction complexity.

4. **Priority Fees**: Uses median of recent fees. Future: Allow user-configurable fee strategies (economy/standard/fast).

5. **Multiple Accounts**: Current implementation uses account 0 only (`m/44'/501'/0'/0'/0'`). Multiple accounts increment the account level: `m/44'/501'/1'/0'/0'`, `m/44'/501'/2'/0'/0'`, etc.

6. **Versioned Transactions**: Initial implementation uses legacy transactions. Future: Support for Versioned Transactions (v0) with Address Lookup Tables for better composability.
