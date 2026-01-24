# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
