# PLANNING

## create new addresses
- [x] Derive hierarchical deterministic keys (BIP32/BIP44) from mnemonic
  - Path: `m/44'/60'/0'/0/{index}` (BIP44 standard for Ethereum)
  - Supports deriving wallets at any index (0, 1, 2, ...)
  - Idempotent: re-deriving the same index updates existing wallet
  - Can restore previously deleted wallets by re-deriving
- [x] Support EVM chains (Ethereum, Base): same private key, different chain IDs
- [x] Import private keys (imported wallets) from anywhere, including the FOSS [Poor Richard's Wallet](https://github.com/artlu99/poor-richards-wallet)
- [x] Watch-only addresses
- [x] Support Tron: different address format (base58check, T-addresses)
  - Path: `m/44'/195'/0'/0/{index}` (BIP44 standard for Tron)
  - Type-safe wallet filtering by keyType (EVM vs Tron)

## view balances on all supported chains
- [x] RPC calls to multiple networks (Etherscan API, TronGrid API)
- [x] Balance queries for Ethereum, Base, and Tron
- [x] View ETH/ETH balances on Ethereum and Base
- [x] View TRX/TRC20 balances on Tron
- [x] Handle RPC failures and fallbacks
- [x] Display balances in UI
- [x] Aggregate balances across chains
- [x] Convert to USD display value (CoinGecko integration)
  - Backend: `/api/prices` endpoint with 1-minute cache TTL
  - Frontend: 5-minute polling interval for price updates
  - Global portfolio total component showing total USD value
  - Individual token USD values displayed inline
- [x] Refresh on demand

## send/hold/receive (QR code) ETH on Ethereum, Base
- [x] Generate QR codes for receiving addresses
- [x] Scan QR codes from camera
- [x] Sign transactions with private keys
- [x] Estimate gas fees (EIP-1559)
- [x] Broadcast transactions to network
- [x] Track transaction status

## send/hold/receive (QR code) USDC on Base
- [x] ERC20 token transfer
- [x] Handle 6 decimals for USDC

## send/hold/receive (QR code) TRX on Tron
- [x] Native TRX transfers
- [x] TronGrid RPC integration
- [x] Bandwidth fee model
- [x] Base58check address format (T-addresses)

## send/hold/receive (QR code) USDT on Tron
- [x] TRC20 token standard
- [x] TronGrid RPC integration
- [x] Different address format (T-addresses)
- [x] Energy fee model
- [x] Handle 6 decimals for USDT

# TODO

## [Difficulty: 3] swap ETH 👉👈 stables
- Direct DEX routing (Uniswap V2/V3, Curve)
- Permit2 signature handling (not legacy approve())
- Slippage tolerance settings
- Price impact estimation
- Maximum spendable amount calculation

## [Difficulty: 2] swap via Matcha/0x
- Integrate 0x API for swap quotes
- Permit2 signature handling (not legacy approve())
- Handle API rate limits
- Parse and execute swap transactions
- Fallback to direct DEX if API fails

## [Difficulty: 4] proxy an x402 call
- ERC-4337 account abstraction
- Permit2 signature handling
- Gas sponsorship considerations
- UserOp bundler integration

## [Difficulty: 3] hold bitcoin
- BIP32/BIP44/BIP84 derivation (legacy, segwit, native segwit)
- Different address formats (1-, 3-, bc1-)
- UTXO management
- Fee estimation (sat/vByte)

## [Difficulty: 4] send/hold/receive USDC on Solana
- SPL token standard
- Solana Web3.js integration
- Associated Token Account (ATA) creation
- Rent exemption handling
- Different transaction model (multiple instructions)

## [Difficulty: 3] send/hold/receive USDC on Tempo
- Research Tempo chain specifications
- Layer 1 or sidechain integration
- Bridge or native token handling

## [Difficulty: 4] bridge/send/hold/receive ETH on mainnet, Base, Arbitrum, OP, Polygon
- Cross-chain messaging (Canonical bridges, Celer, Stargate)
- Gas estimation on destination chain
- Relay transaction monitoring
- Handle bridge delays and finality
- Chain-specific RPC endpoints

## [Difficulty: 5] swap ETH for subset of ERC20s, with safety checks
- Token contract verification
- Permit2 signature handling (not legacy approve())
- isClanker integration (honeypot detection)
- Degen bot checker integrations (Token Sniffer, De.Fi, etc.)
- Liquidity depth checks
- Transfer fee detection
- Mint authority revocation check
- Honeypot simulation testing
- Blacklist/whitelist management
