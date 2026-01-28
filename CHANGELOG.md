# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.4] - 2026-01-28

### Added
- Transaction history API and UI for EVM addresses with dust/spam filtering
- Transaction receipt lookup endpoint and status view for recent sends
- Address reputation and blocklist system with safety badges and blocklist management UI
- Address details route aggregating balances, history, and safety signals

### Changed
- Tightened validation and error handling for transaction-related APIs
- Improved portfolio total and USD value handling across the wallet
- Refined ENS/Basename resolution UX and navigation to address details

### Fixed
- Filter out zero-value ERC20 spam and gas-waste attacks from transaction lists
- Minor layout and navigation issues in send/receive flows

## [0.0.3] - 2026-01-26

### Added
- introductory links
- Mobile wallet carousel with swipe navigation
- Drag-and-drop wallet reordering (desktop only)
- ENS and Basename address resolution (client-side)

### Changed
- Wallet list split into mobile (carousel) and desktop (sortable list) views
- Send/Receive buttons stack vertically on desktop with text labels, remain horizontal on mobile

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
