# Cloudflare Workers + React Starter

**Stack**: Bun | Hono | React 19 | Vite | Cloudflare Workers
**Type-safe full-stack** with shared types

## Dir Structure
```
src/
  backend/index.ts      # Hono API (CORS→CSRF→headers middleware)
  frontend/
    components/         # UI components
    hooks/             # Custom hooks (useXxxQuery pattern)
    providers/         # Context (theme)
    routes/            # Pages (Wouter)
    App.tsx            # Routes
    main.tsx           # Entry
    store.ts           # Zustand (localStorage)
    sessionStore.ts    # Zustand (sessionStorage)
    constants.ts       # Type-safe constants
  shared/types.ts      # Frontend+Backend interfaces
```

**Aliases**: `~/` → frontend, `@shared/` → shared

## State Rules
- **Server data** → TanStack Query (hooks in `frontend/hooks/`)
- **UI state** → Zustand with persistence middleware
- **Forms** → React state or URL params
- **API contracts** → `@shared/types.ts` (end-to-end type safety)

## Tech Choices
| Frontend | Backend | Tooling |
|----------|---------|---------|
| Wouter (not React Router) | Hono | Biome (lint+format) |
| valibot (not Zod) | itty-fetcher | Lefthook (pre-commit tsc) |
| Zustand | tiny-invariant | TypeScript project refs |
| TanStack Query | Evolu (local-first DB) | Bun (lockb) |
| TailwindCSS v4 + DaisyUI | | Vite + SWC |
| Framer Motion | | Wrangler |

### Evolu Database
**Local-first SQLite** with encrypted sync. Uses `@evolu/common` and `@evolu/react-web`.

**Canonical documentation**: https://www.evolu.dev/llms.txt

**Schema**: Defined in `src/frontend/lib/schema.ts` using Evolu's type system
- `id("TableName")` for auto-generated IDs
- `union("a", "b", "c")` for enums (not `literal`)
- `nullOr(Type)` for nullable fields
- `SqliteBoolean` for booleans (see below)

**Important**: Evolu uses **SqliteBoolean**, which is `0 | 1 | null`, **not** JavaScript `boolean`
- Use `sqliteTrue` (1) and `sqliteFalse` (0) from `@evolu/common`
- Never use `true`/`false` - TypeScript won't catch this at runtime
- Schema fields: `fieldName: nullOr(SqliteBoolean)`

**Data stored unencrypted at rest**, only encrypted during transport (sync to relays)

## Patterns

### Do's ✅
- Functional components, custom hooks, absolute imports, shared types
- Plain objects with TypeScript interfaces (over classes)
- ES modules (`import`/`export`) for encapsulation
- `unknown` over `any` for type-safe uncertainty
- `radash` for type-safe immutable functional operations (over raw TypeScript implementations)
- Array operators (`.map()`, `.filter()`, `.reduce()`) for immutable transformations
- Type narrowing with exhaustive `switch` clauses
- Discriminated unions with `ok: boolean` for API responses that can fail (`BalanceResult` pattern)

### Don'ts ❌
- Relative imports, Zod, class components, CommonJS, skip type defs
- `any` types or unchecked type assertions (`as Type`)
- Class syntax for state/data structures
- JavaScript `true`/`false` for Evolu booleans - use `sqliteTrue`/`sqliteFalse`

## Commands
```bash
bun dev              # localhost:5173
bunx tsc -b --noEmit    # type check
bun biome check --write .  # Lint and format
```

## Key Files
- `backend/index.ts` - API endpoints
- `frontend/App.tsx` - Routes
- `shared/types.ts` - Type contracts
- `vite.config.ts` - Aliases, plugins
- `wrangler.toml` - Deployment
- `tsconfig.json` - Project refs (app/node/worker)

## Gaps
No backend database, auth, or CI/CD configured.

---

## Git
- Main branch: `main`

## Artifacts

For Markdown documentation during implementation:
- Keep it compact and machine-oriented
- Include: scope, new/changed files, key UI/state decisions, acceptance checklist
- Skip: prose, mockups, and recommendations that don’t affect implementation
---

## React Best Practices

### Component Patterns
- Functional components with Hooks (no class components or lifecycle methods)
- Pure render functions (no side effects during render)
- One-way data flow (props down, events up)
- Small, composable components

### State & Effects
- Never mutate state directly (use immutable updates with spread syntax)
- Minimize `useEffect` - primarily for external synchronization, not "on change" reactions
- Avoid `setState` inside `useEffect` (degrades performance)
- Include all dependencies in effect arrays (don't suppress ESLint rules)
- Follow Rules of Hooks (unconditional, top-level calls)

### Performance & UX
- Rely on React Compiler (omit `useMemo`, `useCallback`, `React.memo`)
- Use functional state updates: `setCount(c => c + 1)` for prev-state dependencies
- Parallel data fetching to reduce network waterfalls
- Loading states: skeleton screens over spinners
- Error boundaries with friendly inline messages
- Suspense for progressive data loading

### UI
- Prefer DaisyUI v5 semantic styles over vanilla CSS or TailwindCSS v4
- Use idiomatic DaisyUI form components and selectors instead of hand-rolled TailwindCSS
- Prefer imported SVG icon families over inline SVG markup

---

## Testing (Bun)

### Framework
- **Files**: `*.test.ts` (logic), `*.test.tsx` (React), co-located with source
- **Run**: `bun test` (built-in test runner)
- **Tools**: `describe`, `test`, `it`, `expect` (Jest-compatible API)

### Mocking
- Mock functions: `mock.fn()` with `mockImplementation()`, `mockResolvedValue()`
- Spies: `spyOn(obj, 'method')` → restore with `.mockRestore()`
- ES module mocks: `mock.module('mod-name', { ... })`
- Place critical mocks at file top, before imports

### Async Testing
- `async/await` for promises
- Rejections: `await expect(promise).rejects.toThrow()`
- Timers: `mock.timers` with `setSystemTime()`, `runAllTimers()`

---

## Comments Policy

Only write high-value comments if at all. Avoid talking to the user through
comments.

---

## General Requirements

- If there is something you do not understand or is ambiguous, seek confirmation
  or clarification from the user before making changes based on assumptions.
