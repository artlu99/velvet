# Underground Velvet Wallet

**Secure privacy, with a velvety smooth touch**.

FOSS, modular, and self-hostable at *de minimis* cost.

## Features

- Multi-chain wallet management (Ethereum, Base, Tron)
- HD wallet derivation (BIP32/44)
- ERC20/TRC20 token balances with USD values
- Gas estimation & transaction broadcasting
- ENS and Basename name resolution (client-side)
- Local-first encrypted sync via Evolu
- Transaction history with dust/spam filtering
- Address reputation and blocklist system with safety badges
- Address details view (balances, history, safety signals)

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

AGENTS.md documents the *external contract* and what the system does (APIs, types, supported chains). CLAUDE.md documents the *internal coding patterns* and how to write the code (patterns, conventions, rules of thumb).

- [SECURITY.md](./SECURITY.md) - Security considerations and threat model
- [CHANGELOG.md](./CHANGELOG.md) - Release history
- [artifacts/POSSIBILITIES.md](./artifacts/POSSIBILITIES.md) - Roadmap and completed features
- [artifacts/MANIFESTO.md](./artifacts/MANIFESTO.md) - Project philosophy

## Roadmap

See [artifacts/POSSIBILITIES.md](./artifacts/POSSIBILITIES.md) for completed features and upcoming work.

## WONTFIX

These are intentional architectural decisions. If you need these features, consider forking the repo.

### Bitcoin Lightning
Out of scope for this project.

### BIP39 Passphrase (25th Word)
Weakens security by sending users down the wrong path:
- the 25th word may be a word, or a sufficiently long random string
- Dictionary-based exposes to relatively easy brute-force attacks
- if you are securing a truly random 25th word anyway, might as well generate fresh wallets

### Easy "Transfer to Myself" Between Own Wallets
Weakens privacy by linking your wallet history:
- On-chain analysis can cluster addresses that pay each other
- Breaks the privacy model of separate funding wallets
- You can already do this manually (send from address A to address B)

**If you need this**: Copy-paste between your own addresses. It's deliberate that this isn't a one-click feature. 

### OAuth / passkeys
Waiting for Evolu to solidify Owners API

## License

[MIT](./LICENSE)
