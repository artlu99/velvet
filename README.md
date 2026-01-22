# Underground Velvet Wallet

**Secure privacy, with a velvety smooth touch**.

FOSS, modular, and self-hostable at *de minimis* cost.

# WHAT YOU CAN DO

## create new addresses
- [ ] Derive hierarchical deterministic keys (BIP32/BIP44) from mnemonic
- [x] Support EVM chains (eth/Base): same private key, different chain IDs
- [x] Import private keys (imported wallets) from anywhere, including the FOSS [Poor Richard's Wallet](https://github.com/artlu99/poor-richards-wallet)
- [x] Watch-only addresses
- [ ] Support Tron: different address format (base58check)

## view ETH balances on mainnet+Base
- [x] RPC calls to multiple networks (Etherscan API)
- [x] Balance queries for Ethereum and Base
- [x] Handle RPC failures and fallbacks
- [x] Display balances in UI

## send/hold/receive (QR code) ETH on mainnet, Base
- [x] Generate QR codes for receiving addresses
- [x] Scan QR codes from camera
- [x] Sign transactions with private keys
- [x] Estimate gas fees
- [x] Broadcast transactions to network
- [x] Track transaction status

## send/hold/receive (QR code) USDC on Base
- [x] ERC20 token transfer
- [x] Handle 6 decimals for USDC

## send/hold/receive (QR code) USDT on Tron
- [ ] TRC20 token standard
- [ ] TronGrid RPC integration
- [ ] Different address format (T-addresses)
- [ ] Bandwidth/energy fee model

## view balances for all of the above
- [x] View ETH balances on Ethereum and Base
- [ ] Aggregate balances across chains
- [ ] Convert to USD display value
- [x] Refresh on demand

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

# WONTFIX
- [ ] send btc over Lightning
