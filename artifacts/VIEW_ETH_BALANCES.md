# PLAN.md: View ETH Balances on Mainnet + Base

## Goal
Implement balance viewing for Ethereum mainnet and Base L2 with persistent caching and USD conversion.

## Tech Stack
- **Language**: TypeScript/Node.js
- **Cache**: LMDB (15 min TTL for balances, 60 sec for prices)
- **Database**: SQLite (better-sqlite3) for persistent data
- **RPC**: Public endpoints (Ankr, Cloudflare) + Alchemy/Infura free tier backup
- **Price API**: CoinGecko → CoinPaprika → Binance waterfall
- **Config**: .env for API keys

## Configuration Files

### `.env` (gitignored)
```bash
ALCHEMY_API_KEY_ETH=your_alchemy_key_here
INFURA_API_KEY=your_infura_key_here
```

### `.env.example` (template)
```bash
ALCHEMY_API_KEY_ETH=
INFURA_API_KEY=
```

### `config/providers.json`
```json
{
  "chains": {
    "1": {
      "name": "Ethereum Mainnet",
      "providers": [
        { "name": "ankr", "url": "https://rpc.ankr.com/eth", "tier": "public" },
        { "name": "cloudflare", "url": "https://cloudflare-eth.com", "tier": "public" },
        { "name": "alchemy", "urlTemplate": "https://eth-mainnet.g.alchemy.com/v2/{API_KEY}", "tier": "free_tier" },
        { "name": "infura", "urlTemplate": "https://mainnet.infura.io/v3/{API_KEY}", "tier": "free_tier" }
      ]
    },
    "8453": {
      "name": "Base",
      "providers": [
        { "name": "base-public", "url": "https://mainnet.base.org", "tier": "public" },
        { "name": "ankr-base", "url": "https://rpc.ankr.com/base", "tier": "public" },
        { "name": "alchemy-base", "urlTemplate": "https://base-mainnet.g.alchemy.com/v2/{API_KEY}", "tier": "free_tier" }
      ]
    }
  }
}
```

### `config/chains.fallback.json`
```json
{
  "chains": [
    {
      "chainId": 1,
      "name": "Ethereum Mainnet",
      "shortName": "ETH",
      "nativeCurrency": { "name": "Ether", "symbol": "ETH", "decimals": 18 },
      "rpcUrls": ["https://rpc.ankr.com/eth", "https://cloudflare-eth.com"],
      "explorerUrl": "https://etherscan.io",
      "isTestnet": false
    },
    {
      "chainId": 8453,
      "name": "Base",
      "shortName": "Base",
      "nativeCurrency": { "name": "Ether", "symbol": "ETH", "decimals": 18 },
      "rpcUrls": ["https://mainnet.base.org", "https://rpc.ankr.com/base"],
      "explorerUrl": "https://basescan.org",
      "isTestnet": false
    }
  ]
}
```

### `migrations/schema.sql`
```sql
-- Chain registry
CREATE TABLE chains (
    chain_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT,
    native_currency_name TEXT,
    native_currency_symbol TEXT,
    native_currency_decimals INTEGER,
    rpc_urls TEXT NOT NULL,
    explorer_url TEXT,
    is_testnet BOOLEAN DEFAULT 0,
    last_updated INTEGER
);

-- Address registry
CREATE TABLE addresses (
    id INTEGER PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    label TEXT,
    added_at INTEGER
);

-- Balance history
CREATE TABLE balance_snapshots (
    id INTEGER PRIMARY KEY,
    address_id INTEGER REFERENCES addresses(id),
    chain_id INTEGER NOT NULL,
    balance TEXT NOT NULL,
    block_number INTEGER,
    timestamp INTEGER,
    source_provider TEXT
);

-- Provider health tracking
CREATE TABLE provider_health (
    id INTEGER PRIMARY KEY,
    provider_name TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    is_healthy BOOLEAN,
    last_check INTEGER,
    avg_latency_ms INTEGER,
    failure_count INTEGER,
    consecutive_failures INTEGER DEFAULT 0,
    UNIQUE(provider_name, chain_id)
);
```

---

## Implementation Steps

### Step 1: Project Initialization
```bash
npm init -y
npm install lmdb better-sqlite3 ethers@6 dotenv node-fetch
npm install -D typescript @types/node tsx
npx tsc --init
```

Create `package.json` scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "tsx --test src/**/*.test.ts",
    "db:init": "tsx migrations/init.ts"
  }
}
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

### Step 2: Database Initialization
Create `migrations/init.ts`:
```typescript
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

const db = new Database('wallet.db');
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Insert fallback chains
const chains = JSON.parse(readFileSync(join(__dirname, '../config/chains.fallback.json'), 'utf-8'));
const insertChain = db.prepare(`
  INSERT OR REPLACE INTO chains (
    chain_id, name, short_name, native_currency_name, native_currency_symbol,
    native_currency_decimals, rpc_urls, explorer_url, is_testnet, last_updated
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

chains.chains.forEach((chain: any) => {
  insertChain.run(
    chain.chainId,
    chain.name,
    chain.shortName,
    chain.nativeCurrency.name,
    chain.nativeCurrency.symbol,
    chain.nativeCurrency.decimals,
    JSON.stringify(chain.rpcUrls),
    chain.explorerUrl,
    chain.isTestnet ? 1 : 0,
    Date.now()
  );
});

console.log('Database initialized');
db.close();
```

Run: `npm run db:init`

### Step 3: Storage Layer

#### `src/storage/lmdb-cache.ts`
```typescript
import { open, LMDB } from 'lmdb';

const BALANCE_TTL_MS = 15 * 60 * 1000;  // 15 minutes
const PRICE_TTL_MS = 60 * 1000;         // 60 seconds

interface CacheEntry {
  value: string;
  blockNumber: number;
  timestamp: number;
}

const lmdb = open({
  path: './cache_db',
  compression: true
});

const balances = lmdb.openCache<CacheEntry>({
  name: 'balances',
  keyEncoding: 'string'
});

const prices = lmdb.openCache<{ value: number; timestamp: number }>({
  name: 'prices',
  keyEncoding: 'string'
});

export const cache = {
  // Balance cache
  getBalance(address: string, chainId: number): CacheEntry | null {
    return balances.get(`${address}:${chainId}`);
  },
  setBalance(address: string, chainId: number, value: string, blockNumber: number): void {
    balances.put(`${address}:${chainId}`, {
      value,
      blockNumber,
      timestamp: Date.now()
    });
  },
  isFreshBalance(entry: CacheEntry | null): boolean {
    return entry !== null && (Date.now() - entry.timestamp) < BALANCE_TTL_MS;
  },

  // Price cache
  getPrice(key: string): { value: number; timestamp: number } | null {
    return prices.get(key);
  },
  setPrice(key: string, value: number): void {
    prices.put(key, { value, timestamp: Date.now() });
  },
  isFreshPrice(entry: { value: number; timestamp: number } | null): boolean {
    return entry !== null && (Date.now() - entry.timestamp) < PRICE_TTL_MS;
  }
};
```

#### `src/storage/sqlite-store.ts`
```typescript
import Database from 'better-sqlite3';

const db = new Database('wallet.db');

export const store = {
  // Chain operations
  getChain(chainId: number) {
    return db.prepare('SELECT * FROM chains WHERE chain_id = ?').get(chainId);
  },
  getAllChains() {
    return db.prepare('SELECT * FROM chains').all();
  },

  // Provider health operations
  getProviderHealth(providerName: string, chainId: number) {
    return db.prepare(`
      SELECT * FROM provider_health
      WHERE provider_name = ? AND chain_id = ?
    `).get(providerName, chainId);
  },
  updateProviderHealth(providerName: string, chainId: number, isHealthy: boolean, latencyMs: number) {
    const stmt = db.prepare(`
      INSERT INTO provider_health (provider_name, chain_id, is_healthy, last_check, avg_latency_ms, failure_count, consecutive_failures)
      VALUES (?, ?, ?, ?, ?, 0, 0)
      ON CONFLICT(provider_name, chain_id) DO UPDATE SET
        is_healthy = excluded.is_healthy,
        last_check = excluded.last_check,
        avg_latency_ms = excluded.avg_latency_ms,
        consecutive_failures = CASE
          WHEN excluded.is_healthy = 0 THEN consecutive_failures + 1
          ELSE 0
        END
    `);
    return stmt.run(providerName, chainId, isHealthy ? 1 : 0, Date.now(), latencyMs);
  },

  // Balance snapshot logging
  logBalanceSnapshot(addressId: number, chainId: number, balance: string, blockNumber: number, provider: string) {
    const stmt = db.prepare(`
      INSERT INTO balance_snapshots (address_id, chain_id, balance, block_number, timestamp, source_provider)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(addressId, chainId, balance, blockNumber, Date.now(), provider);
  },

  close() {
    db.close();
  }
};
```

### Step 4: RPC Client

#### `src/providers/rpc-client.ts`
```typescript
export interface RpcClient {
  call(method: string, params: any[]): Promise<any>;
  getBalance(address: string): Promise<{ balance: string; blockNumber: number }>;
}

export function createRpcClient(url: string): RpcClient {
  async function call(method: string, params: any[]): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1
      })
    });

    if (!response.ok) {
      throw new Error(`RPC error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RPC error: ${data.error.code} - ${data.error.message}`);
    }

    return data.result;
  }

  return {
    call,
    async getBalance(address: string) {
      const [balance, blockNumber] = await Promise.all([
        call('eth_getBalance', [address, 'latest']),
        call('eth_blockNumber', [])
      ]);

      return {
        balance: balance,
        blockNumber: parseInt(blockNumber, 16)
      };
    }
  };
}
```

### Step 5: Provider Selector

#### `src/providers/provider-selector.ts`
```typescript
import { createRpcClient } from './rpc-client.js';
import { config } from './config.js';
import { store } from '../storage/sqlite-store.js';
import { cache } from '../storage/lmdb-cache.js';

const HEALTHY_SCORE_THRESHOLD = 0.7;
const MAX_CONSECUTIVE_FAILURES = 6;

export async function selectProvider(chainId: number) {
  const chainConfig = config.chains[String(chainId)];
  if (!chainConfig) {
    throw new Error(`Unknown chain: ${chainId}`);
  }

  // Filter to healthy providers, preferring public tier
  for (const provider of chainConfig.providers) {
    const health = store.getProviderHealth(provider.name, chainId);

    const isHealthy = !health ||
      (health.is_healthy &&
       (health.consecutive_failures || 0) < MAX_CONSECUTIVE_FAILURES);

    const isBackedOff = cache.isRateLimited(provider.name);

    if (isHealthy && !isBackedOff) {
      return {
        name: provider.name,
        url: provider.url || provider.urlTemplate?.replace('{API_KEY}', process.env[`${provider.name.toUpperCase()}_API_KEY`] || ''),
        tier: provider.tier
      };
    }
  }

  throw new Error('No healthy providers available');
}

export async function fetchBalance(address: string, chainId: number) {
  // Check cache first
  const cached = cache.getBalance(address, chainId);
  if (cache.isFreshBalance(cached)) {
    return {
      balance: cached!.value,
      blockNumber: cached!.blockNumber,
      source: 'cache'
    };
  }

  // Try providers in order
  let lastError: Error | null = null;
  const startTime = Date.now();

  for (const provider of config.chains[String(chainId)].providers) {
    try {
      const url = provider.url || provider.urlTemplate?.replace('{API_KEY}',
        process.env[`${provider.name.toUpperCase()}_API_KEY`] || '');

      const client = createRpcClient(url);
      const result = await client.getBalance(address);

      // Update health
      store.updateProviderHealth(provider.name, chainId, true, Date.now() - startTime);

      // Cache the result
      cache.setBalance(address, chainId, result.balance, result.blockNumber);

      return {
        balance: result.balance,
        blockNumber: result.blockNumber,
        source: provider.name
      };
    } catch (error) {
      lastError = error as Error;
      store.updateProviderHealth(provider.name, chainId, false, Date.now() - startTime);
    }
  }

  // All providers failed - return stale cache if available
  if (cached) {
    return {
      balance: cached.value,
      blockNumber: cached.blockNumber,
      source: 'cache-stale',
      warning: 'All providers unavailable, showing stale data'
    };
  }

  throw lastError || new Error('Failed to fetch balance');
}
```

### Step 6: Price Fetchers

#### `src/providers/price-fetchers.ts`
```typescript
import { cache } from '../storage/lmdb-cache.js';

async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal });
}

const priceProviders = [
  {
    name: 'coingecko',
    fetch: async () => {
      const res = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await res.json();
      return data.ethereum.usd;
    }
  },
  {
    name: 'coinpaprika',
    fetch: async () => {
      const res = await fetchWithTimeout('https://api.coinpaprika.com/v1/tickers/eth-ethereum');
      const data = await res.json();
      return parseFloat(data.quotes.USD.price);
    }
  },
  {
    name: 'binance',
    fetch: async () => {
      const res = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
      const data = await res.json();
      return parseFloat(data.price);
    }
  }
];

export async function getEthPrice(): Promise<number> {
  // Check cache
  const cached = cache.getPrice('eth:price:usd');
  if (cache.isFreshPrice(cached)) {
    return cached!.value;
  }

  // Try each provider
  for (const provider of priceProviders) {
    try {
      const price = await provider.fetch();
      cache.setPrice('eth:price:usd', price);
      return price;
    } catch (error) {
      console.warn(`${provider.name} failed:`, error);
    }
  }

  // Return stale cache with warning
  if (cached) {
    console.warn('All price providers failed, returning stale price');
    return cached.value;
  }

  throw new Error('Unable to fetch ETH price');
}
```

### Step 7: Public API

#### `src/api/balance.ts`
```typescript
import { fetchBalance } from '../providers/provider-selector.js';
import { getEthPrice } from '../providers/price-fetchers.js';
import { ethers } from 'ethers';

export interface BalanceResult {
  address: string;
  chainId: number;
  balanceWei: string;
  balanceEth: string;
  balanceUsd?: number;
  blockNumber: number;
  source: string;
  warning?: string;
}

export async function getBalance(address: string, chainId: number): Promise<BalanceResult> {
  const result = await fetchBalance(address, chainId);

  const balanceWei = result.balance;
  const balanceEth = ethers.formatEther(balanceWei);

  const output: BalanceResult = {
    address,
    chainId,
    balanceWei,
    balanceEth,
    blockNumber: result.blockNumber,
    source: result.source
  };

  if (result.warning) {
    output.warning = result.warning;
  }

  return output;
}

export async function getBalanceWithUsd(address: string, chainId: number): Promise<BalanceResult> {
  const balanceResult = await getBalance(address, chainId);
  const price = await getEthPrice();

  const balanceEth = parseFloat(balanceResult.balanceEth);
  balanceResult.balanceUsd = balanceEth * price;

  return balanceResult;
}

export async function getBalancesBatch(addresses: string[], chainId: number): Promise<BalanceResult[]> {
  return Promise.all(addresses.map(addr => getBalance(addr, chainId)));
}
```

### Step 8: Main Entry Point

#### `src/index.ts`
```typescript
import dotenv from 'dotenv';
dotenv.config();

import { getBalance, getBalanceWithUsd, getBalancesBatch } from './api/balance.js';

export { getBalance, getBalanceWithUsd, getBalancesBatch };

// CLI for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const address = process.argv[2] || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'; // Vitalik's address

  console.log(`Fetching balance for ${address}...`);
  const result = await getBalanceWithUsd(address, 1);
  console.log(JSON.stringify(result, null, 2));
}
```

---

## Testing

### Manual Test
```bash
npm run dev 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### Test File: `src/api/balance.test.ts`
```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import { getBalance, getBalanceWithUsd } from './balance.js';

test('fetches balance for mainnet', async () => {
  const result = await getBalance('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 1);
  assert.equal(result.chainId, 1);
  assert.ok(parseFloat(result.balanceEth) > 0);
  assert.ok(result.blockNumber > 0);
});

test('includes USD conversion', async () => {
  const result = await getBalanceWithUsd('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 1);
  assert.ok(result.balanceUsd !== undefined);
  assert.ok(result.balanceUsd! > 0);
});

test('returns cached balance on second call', async () => {
  const addr = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  await getBalance(addr, 1);
  const result = await getBalance(addr, 1);
  assert.equal(result.source, 'cache');
});
```

---

## NPM Dependencies

```json
{
  "dependencies": {
    "lmdb": "^3.1.0",
    "better-sqlite3": "^11.0.0",
    "ethers": "^6.13.0",
    "dotenv": "^16.4.5",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0"
  }
}
```

---

## Next Steps

After this feature is working:
1. Send/hold/receive ETH
2. Transaction history (consider Ponder.sh for indexing)
3. Gas estimation
4. USDC on Base (ERC20)
5. USDT on Tron
