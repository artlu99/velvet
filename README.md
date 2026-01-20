# Underground Velvet Wallet

**Secure privacy, with a velvety smooth touch**.

# WHAT YOU CAN DO

## [Difficulty: 2] create new addresses
- Generate mnemonic phrase (BIP39)
- Derive hierarchical deterministic keys (BIP32/BIP44)
- Support EVM chains (eth/Base): same private key, different chain IDs
- Support Tron: different address format (base58check)

## [Difficulty: 2] view ETH balances on mainnet+Base
- RPC calls to multiple networks (Infura/Alchemy/public RPCs)
- Batch balance queries for efficiency
- Handle RPC failures and fallbacks

## [Difficulty: 3] send/hold/receive (QR code) ETH on mainnet, Base
- Generate QR codes for receiving addresses
- Scan QR codes from camera/gallery
- Sign transactions with private keys
- Estimate gas fees
- Broadcast transactions to network
- Track transaction status

## [Difficulty: 3] send/hold/receive (QR code) USDC on Base
- ERC20 token interactions (approve, transfer)
- Handle 6 decimals for USDC
- Manage token allowances for spending

## [Difficulty: 3] send/hold/receive (QR code) USDT on Tron
- TRC20 token standard
- TronGrid RPC integration
- Different address format (T-addresses)
- Bandwidth/energy fee model

## [Difficulty: 2] view balances for all of the above
- Aggregate balances across chains
- Convert to USD display value
- Refresh on demand or background polling

# TODO

## [Difficulty: 3] swap ETH 👉👈 stables
- Direct DEX routing (Uniswap V2/V3, Curve)
- Slippage tolerance settings
- Price impact estimation
- Maximum spendable amount calculation

## [Difficulty: 2] swap via Matcha/0x
- Integrate 0x API for swap quotes
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
- isClanker integration (honeypot detection)
- Degen bot checker integrations (Token Sniffer, De.Fi, etc.)
- Liquidity depth checks
- Transfer fee detection
- Mint authority revocation check
- Honeypot simulation testing
- Blacklist/whitelist management

# WONTFIX
- send btc over Lightning