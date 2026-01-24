# Velvet Wallet - API Reference

LLM consumption target. For coding conventions and patterns, see [CLAUDE.md](./CLAUDE.md).

## Architecture

- `src/backend/` - Hono API on Cloudflare Workers
- `src/frontend/` - React 19 app (components, hooks, routes, providers)
- `src/shared/` - Type contracts shared between frontend and backend

## Type System

**Shared Types** (`src/shared/types.ts`):
- API contracts: `BalanceResult`, `PriceResult`, `GasEstimateResult`, etc.
- Discriminated unions: `{ ok: true, data: T } | { ok: false, error: string, code: ErrorCode }`
- All types use `const` assertions for literal types

**Backend Helpers** (`src/backend/lib/`):
- `validateAddress()` returns `{ ok: true, address: Address } | { ok: false, error: ErrorResponse }`
- `validateChainId()` returns `{ ok: true, chainId: 1 | 8453 } | { ok: true, chainId: "tron" } | { ok: false, ... }`
- `parseBigInt()` for safe BigInt parsing
- Error builders: `balanceError()`, `priceError()`, `gasEstimateError()`, etc.

## API Routes

### GET Routes
```
GET  /api/name                              # App name
GET  /api/prices?ids=ethereum,tron          # CoinGecko prices
GET  /api/balance/:address?chainId=1        # EVM native balance
GET  /api/balance/erc20/:address/:contract?chainId=1  # ERC20 token balance
GET  /api/balance/tron/:address             # Tron native balance
GET  /api/balance/trc20/:address/:contract  # TRC20 token balance
GET  /api/ens/:address                      # ENS reverse lookup
GET  /api/transaction-count/:address?chainId=1  # EVM nonce
```

### POST Routes
```
POST /api/estimate-gas                      # EVM gas estimation
POST /api/estimate-gas/erc20                # ERC20 transfer gas
POST /api/estimate-gas/tron                 # Tron/TRC20 gas
POST /api/broadcast-transaction             # EVM broadcast
POST /api/broadcast-transaction/tron        # Tron broadcast
```

### Response Pattern
All endpoints return discriminated unions:
```typescript
// Success
{ ok: true, data: T, timestamp?: number }

// Error
{ ok: false, error: string, code: ErrorCode }
```

Error codes: `INVALID_ADDRESS`, `INVALID_CHAIN`, `RATE_LIMITED`, `API_ERROR`, `NETWORK_ERROR`, etc.

## Cache Strategy

**KV Store**: Cloudflare Workers KV
- Balance queries: 60s TTL (`BALANCE_CACHE_TTL_SECONDS`)
- ENS lookups: 30min TTL (`ENS_CACHE_TTL_SECONDS`)
- Prices: 60s TTL

**withCache() helper**:
```typescript
const result = await withCache(c, {
  cacheKey: `balance:${chainId}:${address}`,
  cacheBust: c.req.query("cacheBust"),  // Set to bypass cache
  headerName: "x-balance-cache",         // Response header
  ttl: 60,
  fetcher: async () => fetchData(),
});
// Returns { cached: T | null, status: "hit" | "miss" | "bypass" }
```

## Blockchain Support

**EVM Chains**:
- Ethereum (chainId: 1)
- Base (chainId: 8453)

**Tron**:
- Native TRX
- TRC20 tokens (USDT)

**Token Standards**:
- ERC20 (EVM)
- TRC20 (Tron)

## Environment Variables

```
NAME                  # App name
ETHERSCAN_API_KEY     # Etherscan API key
COINGECKO_API_KEY     # CoinGecko API key
BALANCE_CACHE         # Cloudflare KV namespace
```

## Out of Scope

See [artifacts/PLANNING.md](./artifacts/PLANNING.md) for roadmap.

**Explicit WONTFIX**:
- Bitcoin Lightning
- Authentication (OAuth, passkeys) - opinionated security decision

## Git

- Branch: `main`
- Format: Conventional Commits
