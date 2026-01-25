# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.2] - 2026-01-25

### Added
- BIP39 passphrase support (25th word) for enhanced wallet security
- Auto-clear clipboard after 12 seconds for sensitive data
- Soft delete wipes data instead of overwriting
- Feature flags system for controlled feature rollouts
- Base mainnet and Tron token icons (USDC, USDT)
- Framer Motion spring transitions for UI animations

### Changed
- Import private key to existing watch-only wallets
- Replaced bottom dock with streamlined menu navigation
- Mnemonic phrases now obscured by default on screen
- Improved gas estimate layout and display
- Enhanced offline mode reliability
- Preloaded image assets for faster rendering

### Fixed
- Portfolio total USD amount calculation

## [0.0.1] - 2026-01-24

### Added
- Initial release
- Multi-chain wallet support (Ethereum/Base + Tron)
- HD wallet derivation (BIP32/44/60/84)
- ERC20/TRC20 token balance fetching with USD values
- CoinGecko price integration
- Gas estimation for EVM and Tron transactions
- Transaction broadcasting for EVM and Tron
- ENS name resolution
- Backend helper modules (validation, cache, errors)
- Type-safe full-stack with shared types
- 60s cache TTL for balances, 30min for ENS

### Infrastructure
- Hono backend on Cloudflare Workers
- React 19 + Vite frontend
- TanStack Query for server state
- Zustand for UI state
- Evolu for local-first encrypted sync
- Test suite with 260+ tests
