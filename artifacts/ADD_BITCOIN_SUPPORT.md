# Bitcoin Support Implementation Plan

**this is a WIP planning document, generated for <$1 in inference costs across multiple frontier models in Jan 2026. As they continue to differ on their opinions, rather than converging on details of the solution, we are punting this until later for now**

## Goal
Add direct, simple Bitcoin (BTC) support targeting **Native SegWit (BIP84)**.
- **Network**: Mainnet only (testnet for development/testing).
- **Address Format**: `bc1q...` (Bech32 P2WPKH).
- **Architecture**: Client-side signing (`@scure/btc-signer`) + Backend proxy to `mempool.space`.

## Scope & Limitations
- **Inputs**: Only spends from BIP84 (`m/84'/0'/0'/0/*`) paths derived from the seed. Only spends **confirmed** UTXOs (unconfirmed UTXOs are excluded for security).
- **Outputs**: Can send to ANY valid Bitcoin address (Legacy, P2SH, SegWit, Taproot).
- **Change**: Returns change to the **Internal Chain** at the **next unused index** (`m/84'/0'/0'/1/{i}`) to preserve privacy. Must track used change indices in Evolu database.
- **Fees**: Uses "halfHourFee" (30 min confirmation) as default. User can select faster/slower options.

## 1. Shared Types (`src/shared/types.ts`)

Add `btc` to the discriminated unions.

```typescript
export type SupportedChainId = 1 | 8453 | "tron" | "btc";

export type BtcBalanceResult =
  | { ok: true; address: string; balanceSat: string; balanceBtc: string; utxoCount: number; timestamp: number }
  | { ok: false; error: string; code: "INVALID_BTC_ADDRESS" | "NETWORK_ERROR" };

export interface BtcUtxo {
  txid: string;
  vout: number;
  value: number; // satoshis
  status: { confirmed: boolean; block_height?: number };
}

export type BtcFeeEstimateResult =
  | { ok: true; fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number; minimumFee: number }
  | { ok: false; error: string; code: "NETWORK_ERROR" };

export type BtcBroadcastResult =
  | { ok: true; txid: string }
  | { ok: false; error: string; code: "INVALID_TRANSACTION" | "BROADCAST_FAILED" };

// Transaction building result
export type BtcBuildTxResult =
  | { ok: true; txHex: string; feeSat: bigint; vsize: number; changeAddress: string }
  | { ok: false; error: string; code: "INSUFFICIENT_FUNDS" | "DUST_OUTPUT" | "TX_TOO_LARGE" | "INVALID_FEE_RATE" };
```

## 2. Backend (`src/backend/`)

Proxy `mempool.space` to hide API keys (future-proof) and handle CORS/Caching.

### 2.1 RPC Client (`src/backend/lib/btc/rpc.ts`)
- `getBtcBalance(address)`: Fetches `chain_stats` + `mempool_stats` from `/address/{addr}`.
- `getBtcUtxos(address)`: Fetches `/address/{addr}/utxo`.
- `getBtcFeeEstimates()`: Fetches `/v1/fees/recommended`.
- `broadcastBtcTransaction(hex)`: POST to `/tx`.

### 2.2 Routes (`src/backend/index.ts`)
- `GET /balance/btc/:address` (Cache: 60s)
- `GET /utxos/btc/:address` (No Cache)
- `GET /fees/btc` (Cache: 30s)
- `POST /broadcast-transaction/btc`

## 3. Frontend Logic (`src/frontend/lib/`)

### 3.1 Dependencies
- Install `@scure/btc-signer` (v1.4.0+).

### 3.2 Key Derivation (`src/frontend/lib/bip32.ts`)

Implement BIP84 derivation for receiving addresses:

```typescript
export function deriveBtcKeyFromMnemonic(
  mnemonic: string,
  index: number,
): { privateKey: `0x${string}`; address: string } {
  // Path: m/84'/0'/0'/0/{index} (External/Receive chain)
  // ... derivation logic using @scure/bip32 and @scure/btc-signer
}
```

For change addresses, track **next unused change index** in Evolu database:

```typescript
export function deriveBtcChangeKeyFromMnemonic(
  mnemonic: string,
  changeIndex: number,  // NOT the same as sender index!
): { privateKey: `0x${string}`; address: string } {
  // Path: m/84'/0'/0'/1/{changeIndex} (Internal/Change chain)
  // Store last used change index in Evolu to increment on each send
}
```

**Privacy requirement**: Always use a fresh change index for each transaction. Track used change indices in Evolu `BtcChangeIndex` table.

### 3.3 Bitcoin Lib (`src/frontend/lib/bitcoin.ts`)

Core functions for transaction building:

```typescript
/**
 * Validate Bitcoin address format (supports all types)
 */
export function isValidBtcAddress(address: string): boolean;

/**
 * Estimate transaction size (P2WPKH vbytes)
 * Formula: 11 + (68 * nInputs) + (31 * nOutputs)
 * Returns: vsize in bytes
 */
export function estimateTxSize(nInputs: number, nOutputs: number): number;

/**
 * Filter UTXOs to only confirmed outputs (security requirement)
 */
export function filterConfirmedUtxos(utxos: BtcUtxo[]): BtcUtxo[] {
  return utxos.filter(utxo => utxo.status.confirmed);
}

/**
 * Calculate maximum spendable amount
 * spendable = sum(UTXOs) - (estimatedFee + dustThreshold)
 */
export function calculateMaxSpendable(
  utxos: BtcUtxo[],
  feeRate: number, // sat/vByte
  targetOutputCount: number = 2, // recipient + change
): bigint;

/**
 * Validate send amount
 */
export function validateSendAmount(
  amountSat: bigint,
  spendableSat: bigint,
): { ok: true } | { ok: false; error: string } {
  if (amountSat <= 0) {
    return { ok: false, error: "Amount must be greater than 0" };
  }
  if (amountSat > spendableSat) {
    return { ok: false, error: "Insufficient funds" };
  }
  return { ok: true };
}

/**
 * Validate fee rate
 */
export function validateFeeRate(
  feeRate: number,
): { ok: true } | { ok: false; error: string } {
  if (feeRate <= 0) {
    return { ok: false, error: "Fee rate must be greater than 0" };
  }
  if (feeRate > 1000) {
    return { ok: false, error: "Fee rate too high (max: 1000 sat/vB)" };
  }
  return { ok: true };
}

/**
 * Select UTXOs using "Largest First" strategy
 */
export function selectUtxos(
  utxos: BtcUtxo[],
  targetAmount: bigint,
): { selected: BtcUtxo[]; total: bigint; error?: string };

/**
 * Build and sign Bitcoin transaction
 * @returns { txHex, feeSat, vsize, changeAddress } or error
 */
export function buildAndSignBtcTx(params: {
  privKey: Uint8Array;
  utxos: BtcUtxo[];
  recipient: string;
  amountSat: bigint;
  feeRate: number; // sat/vByte
  changeAddress: string;
}): BtcBuildTxResult {
  // 1. Validate transaction size < 100,000 vbytes
  // 2. Calculate estimated fee
  // 3. Add recipient output
  // 4. Add change output if > dust threshold (546 sats)
  // 5. Sign and finalize
  // 6. Return txHex, actual fee, actual vsize
}
```

## 4. Frontend UI

### 4.1 Hooks

```typescript
// Balance query (60s cache via backend)
export function useBtcBalanceQuery(address: string) {
  return useQuery({
    queryKey: ["btcBalance", address],
    queryFn: () => api.get<BtcBalanceResult>(`/balance/btc/${address}`),
    refetchInterval: 60_000, // 1 minute
  });
}

// UTXOs query (no cache - must be fresh)
export function useBtcUtxosQuery(address: string) {
  return useQuery({
    queryKey: ["btcUtxos", address],
    queryFn: () => api.get<BtcUtxo[]>(`/utxos/btc/${address}`),
    refetchOnWindowFocus: true,
  });
}

// Fee estimates query (30s cache via backend)
export function useBtcFeesQuery() {
  return useQuery({
    queryKey: ["btcFees"],
    queryFn: () => api.get<BtcFeeEstimateResult>(`/fees/btc`),
    refetchInterval: 30_000, // 30 seconds
    staleTime: 30_000,
  });
}

// Broadcast transaction mutation
export function useBroadcastBtcTransactionMutation() {
  return useMutation({
    mutationFn: (txHex: string) =>
      api.post<{ signedTransaction: string }, BtcBroadcastResult>(
        "/broadcast-transaction/btc",
        { signedTransaction: txHex },
      ),
    onSuccess: (data) => {
      if (data.ok) {
        // Show success message with txid link
        // Redirect to explorer: https://mempool.space/tx/{data.txid}
      }
    },
    onError: (error) => {
      // Handle broadcast failures:
      // - "Invalid transaction" - ask user to try again
      // - "Network error" - retry with exponential backoff
      // - Save signed tx to local storage for manual broadcast
    },
  });
}
```

### 4.2 Components

**WalletBalance**
- Add BTC display card with balance in BTC (8 decimal places) and satoshis
- Format: `₿ 0.12345678` (8 decimal places for BTC)
- Show UTXO count for transparency

**SendForm**
1. **Address Validation**: Detect BTC address type (Legacy/P2SH/SegWit/Taproot) on input
2. **On Mount**: Fetch UTXOs and Fees
3. **UTXO Filtering**: Use `filterConfirmedUtxos()` to only spend confirmed outputs
4. **Max Spendable**: Calculate with `calculateMaxSpendable()` and show as "Max" button
5. **Fee Selection**: Dropdown with:
   - Economy (slowest) - `economyFee`
   - Hour - `hourFee`
   - Half Hour (default) - `halfHourFee`
   - Fastest - `fastestFee`
6. **Amount Validation**: Use `validateSendAmount()` before enabling "Send" button
7. **Fee Validation**: Use `validateFeeRate()` on custom fee inputs
8. **Change Address**: Derive next unused change index from Evolu, increment after broadcast
9. **Sign**: Call `buildAndSignBtcTx()` with private key, UTXOs, recipient, amount, fee rate, change address
10. **Broadcast**: Call `useBroadcastBtcTransactionMutation` with signed tx hex
11. **Error Handling**:
    - `INSUFFICIENT_FUNDS`: Show friendly message with max spendable
    - `DUST_OUTPUT`: Warn that amount + fee is too small
    - `TX_TOO_LARGE`: Suggest sending smaller amount
    - `INVALID_FEE_RATE`: Show fee range (1-1000 sat/vB)
    - Broadcast failure: Save signed tx to localStorage for retry/manual broadcast
12. **Success**: Show txid link to mempool.space explorer

**Explorer Links**
- Transaction: `https://mempool.space/tx/{txid}`
- Address: `https://mempool.space/address/{address}`
- Use consistent `txid` terminology (not `txHash`)

## Security Checklist

1. **Private Keys**: Never leave `bip32.ts` / `bitcoin.ts` (client-side only).
2. **Dust**: Do not create outputs < 546 sats (P2WPKH dust threshold).
3. **Change**: Always send change to `m/84'/0'/0'/1/{next_unused_index}` (Internal Chain) - never reuse change indices.
4. **Validation**:
   - Validate address format before sending (`isValidBtcAddress()`).
   - Validate amount > 0 and <= spendable (`validateSendAmount()`).
   - Validate fee rate 1-1000 sat/vByte (`validateFeeRate()`).
   - Validate transaction size < 100,000 vbytes before signing.
5. **UTXO Security**: Only spend confirmed UTXOs (`filterConfirmedUtxos()`).
6. **Fee Rate**: Use `halfHourFee` (30 min) as default, allow user selection.
7. **Testnet Testing**: Test all flows on Bitcoin testnet before mainnet deployment.
8. **Error Handling**: Save failed broadcast transactions to localStorage for manual recovery.
