# Underground Velvet Wallet

**Secure privacy, with a velvety smooth touch**.

FOSS, modular, and self-hostable at *de minimis* cost.

## Features

- Multi-chain wallet management (Ethereum, Base, Tron)
- HD wallet derivation (BIP32/44/60/84)
- ERC20/TRC20 token balances with USD values
- Gas estimation & transaction broadcasting
- ENS name resolution
- Local-first encrypted sync via Evolu

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Backend | Hono, Cloudflare Workers, Bun |
| Frontend | React 19, Vite, TailwindCSS v4, DaisyUI |
| State | TanStack Query, Zustand, Evolu (local-first SQLite) |
| Blockchain | viem (EVM), TronWeb (Tron), CoinGecko (prices) |

## Getting Started

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and workflow.

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Coding conventions and patterns (LLM context)
- [AGENTS.md](./AGENTS.md) - API reference and type system
- [SECURITY.md](./SECURITY.md) - Security considerations and threat model
- [CHANGELOG.md](./CHANGELOG.md) - Release history
- [artifacts/PLANNING.md](./artifacts/PLANNING.md) - Roadmap and completed features
- [artifacts/MANIFESTO.md](./artifacts/MANIFESTO.md) - Project philosophy

## Roadmap

See [artifacts/PLANNING.md](./artifacts/PLANNING.md) for completed features and upcoming work.

## WONTFIX

- **Bitcoin Lightning** - Out of scope
- **Authentication** - Opinionated decision: locking the app with a passkey provides false security
  - does not stop $5 wrench attacks
  - biometrics more often betray user (rekt via unknowingly pre-loaded malicious auto-approvals)
  - with crypto on a phone, you must be willing to fight for it, or let it go
  - if desired, fork the repo and ask LLM to add standard OAuth2 on top of Hono + React

## License

[MIT](./LICENSE)
