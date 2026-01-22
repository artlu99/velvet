# Enable USDT on Tron

## Overview

This plan implements USDT (TRC20) support on Tron, focusing on balance viewing and sending. Basic TRX balance support is included for fee payments. The implementation integrates TronGrid RPC, handles Tron's base58check address format, and supports TRC20 token interactions within the existing unified wallet architecture.

**Scope**: Display balances + send USDT. Skip address derivation/wallet import (assume Tron addresses already exist in Evolu database).

**Key Decision**: Use `"tron"` as string literal chain ID (not numeric).

## Key Differences from EVM Chains

- **Address Format**: Tron uses base58check encoding (T-addresses like `TXYZ...`) instead of hex (0x...)
- **RPC**: TronGrid API instead of standard Ethereum RPC
- **Fee Model**: Bandwidth/Energy instead of gas fees
- **Token Standard**: TRC20 instead of ERC20
- **Transaction Format**: Different transaction structure and signing mechanism
- **USDT Contract**: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` on Tron mainnet

## Implementation Plan

### 1. Add Tron Dependencies

Install Tron-specific library:
```bash
bun add tronweb
```

### 2. Extend Type System

**File**: `src/shared/types.ts`

**Changes**:
1. Extend `SupportedChainId` to support string literal:
   ```typescript
   export type SupportedChainId = 1 | 8453 | "tron";
   ```

2. Add Tron-specific balance types:
   ```typescript
   export interface TronBalanceRequest {
     address: string;
   }

   export interface TronBalanceSuccess {
     ok: true;
     address: string;
     balanceTrx: string;      // In SUN (1 TRX = 1,000,000 SUN)
     balanceSun: string;      // In SUN (smallest unit)
     bandwidth: {             // Bandwidth info
       free: number;
       used: number;
     };
     energy: {                // Energy info
       free: number;
       used: number;
     };
     timestamp: number;
   }

   export interface TronBalanceError {
     ok: false;
     error: string;
     code: "INVALID_TRON_ADDRESS" | "NETWORK_ERROR";
   }

   export type TronBalanceResult = TronBalanceSuccess | TronBalanceError;
   ```

3. Add TRC20 balance types (USDT):
   ```typescript
   export interface Trc20BalanceRequest {
     address: string;
     contract: string;
   }

   export interface Trc20BalanceSuccess {
     ok: true;
     address: string;
     contract: string;
     symbol: string;
     decimals: number;
     balanceRaw: string;
     balanceFormatted: string;
     timestamp: number;
   }

   export interface Trc20BalanceError {
     ok: false;
     error: string;
     code: "INVALID_TRON_ADDRESS" | "INVALID_CONTRACT" | "NETWORK_ERROR";
   }

   export type Trc20BalanceResult = Trc20BalanceSuccess | Trc20BalanceError;
   ```

4. Add Tron gas estimation types (bandwidth/energy model):
   ```typescript
   export interface TronGasEstimateRequest {
     from: string;
     to: string;
     contract: string;
     amount: string;
   }

   export interface TronGasEstimateSuccess {
     ok: true;
     bandwidthRequired: number;
     energyRequired: number;
     energyFee: string;     // In SUN
     totalCostTrx: string;  // Total TRX needed
   }

   export interface TronGasEstimateError {
     ok: false;
     error: string;
     code: "INSUFFICIENT_BANDWIDTH" | "INSUFFICIENT_ENERGY" | "NETWORK_ERROR";
   }

   export type TronGasEstimateResult = TronGasEstimateSuccess | TronGasEstimateError;
   ```

5. Add Tron transaction types:
   ```typescript
   export interface TronBroadcastRequest {
     signedTransaction: string;
   }

   export interface TronBroadcastSuccess {
     ok: true;
     txHash: string;
   }

   export interface TronBroadcastError {
     ok: false;
     error: string;
     code: "INVALID_TRANSACTION" | "BROADCAST_FAILED";
   }

   export type TronBroadcastResult = TronBroadcastSuccess | TronBroadcastError;
   ```

### 3. Update Backend Chain Support

**File**: `src/backend/lib/balance.ts`

**Changes**:
1. Update `SUPPORTED_CHAIN_IDS`:
   ```typescript
   const SUPPORTED_CHAIN_IDS: SupportedChainId[] = [1, 8453, "tron"];
   ```

2. Update `isSupportedChainId` to handle string literal:
   ```typescript
   export function isSupportedChainId(chainId: string | number): chainId is SupportedChainId {
     return SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId);
   }
   ```

3. Update `parseChainId` to handle both formats:
   ```typescript
   export function parseChainId(chainId: string | number | null | undefined): SupportedChainId | null {
     if (chainId === null || chainId === undefined) return null;
     if (chainId === "tron") return "tron";
     const num = typeof chainId === "string" ? parseInt(chainId, 10) : chainId;
     if (num === 1 || num === 8453) return num;
     return null;
   }
   ```

### 4. Create Tron RPC Library

**New file**: `src/backend/lib/tron/rpc.ts`

**Purpose**: TronGrid API client for Tron blockchain interactions.

**Environment Variables**:
- `TRONGRID_API_URL` - Default: `https://api.trongrid.io`
- `TRONGRID_API_KEY` - Optional, for higher rate limits

**Functions**:
```typescript
export async function getTronBalance(
  env: Env,
  address: string
): Promise<TronBalanceResult>;

export async function getTrc20Balance(
  env: Env,
  address: string,
  contract: string
): Promise<Trc20BalanceResult>;

export async function estimateTrc20Transfer(
  env: Env,
  from: string,
  to: string,
  contract: string,
  amount: string
): Promise<TronGasEstimateResult>;

export async function broadcastTronTransaction(
  env: Env,
  signedTransaction: string
): Promise<TronBroadcastResult>;
```

**Implementation Notes**:
- Use TronGrid REST API
- Handle Tron's base58check address format
- Return balances in SUN (1 TRX = 1,000,000 SUN)
- USDT uses 6 decimals
- Calculate bandwidth/energy requirements for TRC20 transfers

### 5. Add Backend API Endpoints

**File**: `src/backend/index.ts`

**Endpoints to add**:

1. **GET /api/balance/tron/:address**
   - Returns TRX balance with bandwidth/energy info
   - Cache: 5 minutes TTL
   - Validates Tron address format (base58check, starts with 'T')

2. **GET /api/balance/trc20/:address/:contract**
   - Returns TRC20 token balance (USDT)
   - Cache: 5 minutes TTL

3. **POST /api/estimate-gas/tron**
   - Estimates bandwidth/energy for TRC20 transfer
   - Request body: `{ from, to, contract, amount }`
   - Returns: `{ bandwidthRequired, energyRequired, energyFee, totalCostTrx }`

4. **POST /api/broadcast-transaction/tron**
   - Broadcasts signed Tron transaction
   - Request body: `{ signedTransaction }`
   - Returns: `{ txHash }`

### 6. Update API Endpoints Definition

**File**: `src/shared/api.ts`

**Changes**:
1. Import new Tron types
2. Add Tron endpoints to `apiEndpoints`
3. Update `ApiResponses` type
4. Ensure `buildUrl` handles Tron's contract parameter

### 7. Add USDT to Token Store

**File**: `src/frontend/providers/tokenStore.ts`

**Changes**:
1. Add USDT on Tron to `INITIAL_TOKENS`:
   ```typescript
   "tether": {
     id: "tether",
     symbol: "usdt",
     name: "Tether USD",
     platforms: {
       tron: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
     },
     detail_platforms: {
       tron: {
         decimal_place: 6,
         contract_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
       },
     },
   }
   ```

2. Update `getTokenByAddress` to handle Tron addresses
3. Update `getTokensByChain` to support "tron"

### 8. Update Token Utilities

**File**: `src/frontend/lib/tokenUtils.ts`

**Changes**:
Update platform ID mapping to include Tron:
```typescript
export function getTokenDecimals(token, chainId) {
  const platformId = chainId === "tron" ? "tron" : chainId === 1 ? "ethereum" : "base";
  const detail = token.detail_platforms[platformId];
  return detail?.decimal_place ?? 18;
}

export function getTokenAddress(token, chainId) {
  const platformId = chainId === "tron" ? "tron" : chainId === 1 ? "ethereum" : "base";
  const address = token.platforms[platformId];
  return address || (chainId === "tron" ? "" : "0x0");
}

export function isNativeToken(token, chainId) {
  const address = getTokenAddress(token, chainId);
  return address === "" || address === "0x0";
}
```

### 9. Create Frontend Hooks

**New files**:

1. **`src/frontend/hooks/queries/useTronBalanceQuery.ts`**
   ```typescript
   export const useTronBalanceQuery = ({ address, enabled = true }) => {
     return useQuery({
       queryKey: ["tronBalance", address],
       queryFn: async () => {
         const url = buildUrl(apiEndpoints.tronBalance.path, { address });
         return api.get<ApiResponses["tronBalance"]>(url);
       },
       enabled: enabled && Boolean(address),
       staleTime: 1000 * 60 * 5,
     });
   };
   ```

2. **`src/frontend/hooks/queries/useTrc20BalanceQuery.ts`**

3. **`src/frontend/hooks/mutations/useTronGasEstimateMutation.ts`**

4. **`src/frontend/hooks/mutations/useBroadcastTronTransactionMutation.ts`**

### 10. Update WalletBalance Component

**File**: `src/frontend/components/WalletBalance.tsx`

**Changes**:
1. Add Tron to `CHAINS` array:
   ```typescript
   const CHAINS: Array<{ id: SupportedChainId; name: string }> = [
     { id: 1, name: "ETH" },
     { id: 8453, name: "Base" },
     { id: "tron", name: "Tron" },
   ];
   ```

2. Add conditional rendering for Tron vs EVM chains

3. Create `TronChainBalance` subcomponent:
   - Fetches TRX balance via `useTronBalanceQuery`
   - Fetches USDT balance via `useTrc20BalanceQuery`
   - Displays: "Tron: X.XX TRX", "Tron USDT: X.XX USDT"
   - Shows bandwidth/energy info on hover

### 11. Update SendForm for Tron

**File**: `src/frontend/components/SendForm.tsx`

**Changes**:
1. Add conditional logic for Tron chain

2. Use Tron gas estimation (bandwidth/energy) for TRC20 transfers

3. Update transaction signing for Tron:
   - Show error: "Tron transaction signing not yet supported"
   - (Future: implement TronWeb signing)

4. Update fee display for Tron:
   - Show "Energy Fee: X.XX TRX" instead of "Gas: ..."

### 12. Update Send Route

**File**: `src/frontend/routes/Send.tsx`

**Changes**:
1. Add Tron to network selector
2. Update chainId type to `SupportedChainId`
3. Update token fetching to include Tron

### 13. Environment Configuration

**.dev.vars**:
```
TRONGRID_API_URL=https://api.trongrid.io
TRONGRID_API_KEY=  # Optional
```

**wrangler.toml**:
```toml
[vars]
TRONGRID_API_URL = "https://api.trongrid.io"

[[unsafe.curves]]
secrets = ["TRONGRID_API_KEY"]
```

## Files to Create

1. `src/backend/lib/tron/rpc.ts` - TronGrid API client
2. `src/frontend/hooks/queries/useTronBalanceQuery.ts`
3. `src/frontend/hooks/queries/useTrc20BalanceQuery.ts`
4. `src/frontend/hooks/mutations/useTronGasEstimateMutation.ts`
5. `src/frontend/hooks/mutations/useBroadcastTronTransactionMutation.ts`

## Files to Modify

1. `src/shared/types.ts` - Add Tron types
2. `src/backend/lib/balance.ts` - Support "tron" chain ID
3. `src/backend/index.ts` - Add Tron API endpoints
4. `src/shared/api.ts` - Add Tron endpoint definitions
5. `src/frontend/providers/tokenStore.ts` - Add USDT on Tron
6. `src/frontend/lib/tokenUtils.ts` - Support Tron platform ID
7. `src/frontend/components/WalletBalance.tsx` - Display Tron balances
8. `src/frontend/components/SendForm.tsx` - Add Tron send logic
9. `src/frontend/routes/Send.tsx` - Add Tron to network selector

## Technical Considerations

1. **Chain ID**: Using string literal `"tron"` for clarity
2. **Address Format**: Tron uses base58check (T-addresses) - validation only, no derivation
3. **Fee Calculation**: Bandwidth is free if account has enough, otherwise costs TRX. Energy needed for TRC20 transfers
4. **USDT Decimals**: USDT on Tron uses 6 decimals (same as USDC on Base)
5. **Transaction Signing**: Marked as "not yet supported" - requires TronWeb integration

## Testing Considerations

- Test Tron address validation
- Test TRX balance fetching
- Test USDT (TRC20) balance fetching
- Test bandwidth/energy estimation
- Test transaction broadcasting (when signing is implemented)
- Test unified wallet view with Tron addresses

## Known Limitations

- Transaction signing not implemented (TronWeb integration needed)
- No watch-only balance queries (requires existing Tron wallet in Evolu)
- Bandwidth/energy display is informational only
- No transaction history for Tron

## Future Enhancements

- Implement Tron transaction signing with TronWeb
- Add Tron to wallet import flow
- Add Tron transaction history
- Support for other TRC20 tokens beyond USDT
