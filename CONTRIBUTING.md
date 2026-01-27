# Contributing to Underground Velvet Wallet

Thanks for your interest in contributing! This document covers the basics.

## Getting Started

```bash
# Clone and install
git clone https://github.com/artlu99/velvet.git
cd velvet
bun install

# Configure environment
cp .dev.vars.example .dev.vars
# Add your API keys to .dev.vars

# Start dev server
bun dev
```

## Deployment

Deploy to Cloudflare Workers using Wrangler:

```bash
bun wrangler login
bun wrangler kv:namespace create BALANCE_CACHE
bun wrangler deploy
```

**Prerequisites:**
- Cloudflare account with Workers enabled
- Environment variables configured in Cloudflare dashboard or `.dev.vars`

## Development Workflow

1. **Create a branch** from `main`
2. **Make changes** following the code style below
3. **Run checks** before committing:
   ```bash
   bun type-check  # TypeScript
   bun lint        # Biome lint + format
   bun test        # Run tests
   ```
4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/)
5. **Open a PR** against `main`

## Code Style

See [CLAUDE.md](./CLAUDE.md) for detailed conventions. Key points:

### Do
- Use absolute imports (`~/` for frontend, `@shared/` for shared)
- Use `unknown` over `any`
- Use discriminated unions for API responses (`{ ok: true, data } | { ok: false, error }`)
- Use `isAddressEqual()` from viem for address comparisons
- Use functional components and hooks

### Don't
- Use relative imports
- Use Zod (use valibot)
- Use `===`/`!==` for EVM addresses
- Call `fetch()` directly (use itty-fetcher via React Query hooks)
- Use JS `true`/`false` for Evolu booleans (use `sqliteTrue`/`sqliteFalse`)

## Project Structure

```
src/
  backend/       # Hono API on Cloudflare Workers
  frontend/      # React 19 + Vite
  shared/        # Shared types (API contracts)
```

## Testing

Tests are co-located with source files (`*.test.ts`, `*.test.tsx`).

```bash
bun test              # Run all tests
bun test --watch      # Watch mode
bun test src/backend  # Run backend tests only
```

---

## Questions?

Open an issue or check existing discussions.
