# Security Documentation

This document addresses security considerations for Underground Velvet Wallet. Each section answers a critical security question about the implementation.

## Private Key Storage

**How are private keys stored and encrypted? Are they ever exposed in memory longer than necessary? When and how are they removed from memory after use?**

Private keys are stored in the local Evolu SQLite database. They are **encrypted at rest** using `XChaCha20-Poly1305` encryption with the owner's encryption key (derived from the Evolu mnemonic). The encryption implementation is in `src/frontend/lib/crypto.ts`:

- **Encryption**: Private keys are encrypted using `encryptPrivateKey()` which uses `XChaCha20-Poly1305` (via Evolu's `createSymmetricCrypto`). Each encrypted key includes a 24-byte nonce and is stored as base64.
- **Storage**: Encrypted keys are stored in the `eoa` table's `encryptedPrivateKey` field. The database itself is local SQLite, not encrypted at the local level.
- **Memory handling**: When decrypting, the decrypted bytes are wiped using `secureWipe()` which fills the Uint8Array with zeros. However, there's a limitation: the final private key string cannot be securely wiped in JavaScript (strings are immutable). The code acknowledges this in `SendForm.tsx`: "Note: privateKey is a string and cannot be securely wiped. The decrypted bytes in decryptPrivateKey are already wiped. The string will be garbage collected when it goes out of scope."
- **Exposure window**: Private keys exist in memory as strings during transaction signing, which happens in `SendForm.tsx`. The key is decrypted, used to sign a transaction via `viem`'s `privateKeyToAccount()` for EVM chains or `TronWeb` for Tron, and then goes out of scope.

**String conversion requirement**: Unfortunately, we hit a point where a string type is required. `viem`'s `privateKeyToAccount()` function requires a hex string (`0x${string}`), not a `Uint8Array`. Similarly, `TronWeb` requires private keys as hex strings. The account objects returned by these libraries also likely store the private key internally as a string. This means:
  - We could minimize exposure by keeping keys as `Uint8Array` internally and only converting to string at the last moment
  - However, the account objects will still hold the key as a string internally
  - The string exists in memory until the account object is garbage collected

**Potential improvement**: We could refactor to:
  1. Keep private keys as `Uint8Array` throughout the codebase
  2. Convert to hex string only when calling `privateKeyToAccount()` or `TronWeb` (minimize exposure window)
  3. However, the account objects will still retain the string internally, so complete avoidance isn't possible with current APIs

**Recommendation**: Consider using Web Crypto API or similar for in-memory key handling if possible, though JavaScript's string immutability limits complete memory wiping. Alternatively, explore if viem or TronWeb support `Uint8Array` private keys, or consider using lower-level signing functions that accept `Uint8Array` directly.

## Key Derivation

**Are BIP32/BIP44 key derivation paths implemented correctly? Are there any vulnerabilities in the mnemonic phrase generation or validation?**

**Current Status**: BIP32/BIP44 key derivation **is implemented** using well-audited libraries. The implementation is in `src/frontend/lib/bip32.ts`:

- **EVM chains**: Uses BIP44 path `m/44'/60'/0'/0/{index}` (standard Ethereum path)
  - Purpose: `44'` (BIP44)
  - Coin type: `60'` (Ethereum)
  - Account: `0'`
  - Change: `0` (external addresses)
  - Address index: `{index}` (0, 1, 2, ...)
- **Tron**: Uses BIP44 path `m/44'/195'/0'/0/{index}` (standard Tron path)
  - Purpose: `44'` (BIP44)
  - Coin type: `195'` (Tron)
  - Account: `0'`
  - Change: `0` (external addresses)
  - Address index: `{index}` (0, 1, 2, ...)

**Implementation details**:
- Uses `@scure/bip39` for mnemonic validation and seed generation
- Uses `@scure/bip32` for HD key derivation (well-audited library)
- Mnemonic validation uses English wordlist from `@scure/bip39/wordlists/english.js`
- Index validation: enforces non-negative indices and maximum BIP32 hardened limit (2^31 - 1)
- Derived keys are encrypted using the same `encryptPrivateKey()` function as imported keys
- Idempotent derivation: re-deriving the same index updates existing wallet (prevents duplicates)

**Mnemonic handling**:
- Mnemonic generation is handled by Evolu (used for app owner encryption key)
- Mnemonic validation uses `bip39.validateMnemonic()` from `@scure/bip39`
- Supports optional passphrase for seed generation (currently not exposed in UI for key derivation)

**Vulnerabilities**:
- Uses standard BIP44 paths, which are widely adopted and compatible with other wallets
- Well-audited libraries reduce risk of implementation errors
- Index bounds are validated to prevent out-of-range derivation
- No custom cryptographic code for key derivation (uses libraries)

**Recommendation**: 
- Consider exposing passphrase support for key derivation if users request it
- Document the derivation paths clearly for users who want to restore wallets in other software
- Consider adding derivation path validation tests against known test vectors

## Transaction Signing

**Are transaction signatures generated securely? Is there any risk of nonce reuse or replay attacks? Are gas estimates validated before signing?**

Transaction signing is handled differently for EVM chains and Tron:

### EVM Chains (Ethereum, Base)

- **Signing**: Uses `viem`'s `privateKeyToAccount().signTransaction()` which implements EIP-1559 transaction signing correctly. Transactions include `chainId` (line 310 in `SendForm.tsx`), which prevents cross-chain replay attacks.
- **Nonce management**: Nonces are fetched from the blockchain via `getTransactionCount()` before signing (lines 284-291 in `SendForm.tsx`). The nonce is fetched fresh for each transaction, preventing reuse.
- **Gas validation**: Gas estimates are fetched from the backend API (`/estimate-gas` endpoint) and validated. The transaction includes `gas`, `maxFeePerGas`, and `maxPriorityFeePerGas` from the estimate (lines 307-309 in `SendForm.tsx`). However, there's no explicit validation that gas estimates are reasonable (e.g., checking against maximum acceptable values).
- **Replay protection**: EIP-1559 transactions include `chainId`, preventing replay across different chains. The `chainId` is validated on the backend via `validateChainId()` in `src/backend/lib/validation.ts`.

### Tron

- **Signing**: Uses `TronWeb` library's `trx.sign()` method for transaction signing. Tron transactions are signed using ECDSA (same as Ethereum).
- **Transaction building**: 
  - Native TRX transfers use `tronWeb.transactionBuilder.sendTrx()` (lines 109-113 in `src/frontend/lib/tron.ts`)
  - TRC20 transfers use `tronWeb.transactionBuilder.triggerSmartContract()` (lines 173-180 in `src/frontend/lib/tron.ts`)
- **Nonce management**: Tron uses a different model - transactions include a reference block and expiration time rather than explicit nonces. The TronWeb library handles this automatically.
- **Fee model**: Tron uses bandwidth/energy model rather than gas fees. Gas estimates come from the backend API (`/estimate-gas/tron` endpoint) and include total cost in TRX.
- **Replay protection**: Tron transactions include reference block and expiration time, which provide replay protection within the Tron network. However, Tron transactions don't include chain IDs (Tron is a single network).

**Potential issues**:
- No explicit maximum gas limit validation for EVM chains (though viem may handle this)
- No explicit maximum fee validation for Tron transactions
- Gas/fee estimates come from a trusted backend, but there's no client-side sanity checking
- Tron transaction signing relies on TronWeb library's implementation

**Recommendation**: 
- Add client-side validation for gas estimates (e.g., maximum acceptable gas limit, minimum/maximum fee per gas for EVM)
- Add client-side validation for Tron fee estimates (maximum acceptable total cost)
- Consider showing gas/fee estimate details to users before signing

## Input Validation

**Are all user inputs (addresses, amounts, transaction data) properly validated and sanitized? Are there risks of injection attacks or malformed data?**

Input validation is implemented using `valibot` schemas and custom validation functions:

- **EVM Address validation**: 
  - Frontend: `EvmAddressSchema` in `src/frontend/lib/crypto.ts` (lines 76-84) uses regex `/^0x[0-9a-fA-F]{40}$/` and checksum validation via `viem`'s `isAddress()`
  - Backend: `validateAddress()` in `src/backend/lib/validation.ts` (lines 72-86) uses `viem`'s `isAddress()` and normalizes addresses
  - Additional checksum validation ensures addresses are valid EIP-55 checksummed addresses
- **Tron Address validation**:
  - Frontend: `isTronAddress()` in `src/frontend/lib/crypto.ts` (lines 47-50) validates base58check format `/^T[a-zA-Z0-9]{33}$/` and checksum via TronWeb
  - Backend: Tron addresses are validated in Tron-specific endpoints
- **Private key validation**: 
  - EVM: `EvmPrivateKeySchema` validates format `/^0x[0-9a-fA-F]{64}$/` and normalizes to lowercase (lines 69-73 in `crypto.ts`)
  - Tron: Tron private keys are validated as 64 hex characters (with or without 0x prefix) in `validateImportInput()` (lines 182-199 in `crypto.ts`)
- **Unified import validation**: `validateImportInput()` in `crypto.ts` (lines 132-208) auto-detects input type with waterfall: EVM private key → EVM address → Tron address → Tron private key
- **Amount validation**: 
  - EVM amounts are validated through `viem`'s `parseEther()` which throws on invalid input
  - Tron amounts are validated as strings and converted to SUN (smallest unit)
  - Both use BigInt for large number handling
- **Transaction data**: 
  - Recipient addresses are validated before gas estimation
  - Transaction parameters are validated on the backend via `validateAddress()`, `validateChainId()`, and `parseBigInt()` in `src/backend/lib/validation.ts`
  - Backend validation is centralized and consistent across endpoints

**Potential issues**:
- No explicit protection against extremely large amounts (though BigInt handles this)
- No validation that recipient address is not the sender (could waste gas/fees but not a security issue)
- Backend uses `c.req.json()` which could be vulnerable to JSON injection if not properly typed (but TypeScript types help)
- Tron address validation relies on TronWeb library

**Recommendation**: 
- Add explicit maximum amount validation
- Consider adding recipient != sender check for UX
- Consider adding rate limiting for import operations to prevent abuse

## RPC Endpoint Security

**How are RPC endpoints validated? Are there risks of man-in-the-middle attacks or malicious RPC providers? Is certificate pinning implemented?**

RPC endpoints are used indirectly through the backend API:

- **Backend RPC usage**: 
  - EVM chains: The backend (`src/backend/lib/rpc.ts`) uses public RPC endpoints and Etherscan API. RPC endpoints are hardcoded in the backend, not user-configurable.
  - Tron: The backend (`src/backend/lib/tron/rpc.ts`) uses TronGrid API for balance queries, gas estimation, and transaction broadcasting. TronGrid endpoints are hardcoded in the backend.
- **No certificate pinning**: There's no explicit certificate pinning implemented. HTTPS is used (via Cloudflare Workers), but standard TLS validation applies.
- **API keys**: 
  - Etherscan API key is stored in Cloudflare Workers environment variables (not exposed to frontend)
  - TronGrid API key (if used) is stored in environment variables
- **No user RPC configuration**: Users cannot configure custom RPC endpoints, reducing risk of malicious endpoints.

**Risks**:
- If the backend is compromised, it could use malicious RPC endpoints
- No certificate pinning means standard TLS vulnerabilities apply
- Etherscan API could be rate-limited or compromised
- TronGrid API could be rate-limited or compromised
- Single point of failure: if backend RPC endpoints fail, all users are affected

**Recommendation**: 
- Consider implementing certificate pinning for critical RPC endpoints
- Document which RPC providers are used and their trust model
- Consider implementing fallback RPC endpoints for redundancy
- Monitor API rate limits and implement proper error handling

## Sync Security

**How is data encrypted during sync? Is the encryption key derivation secure? Are there risks of data leakage during synchronization?**

Sync is handled by Evolu:

- **Encryption**: Data is encrypted during transport using the owner's encryption key (derived from the Evolu mnemonic). The encryption happens at the Evolu layer, not in application code.
- **Encryption algorithm**: Evolu uses `XChaCha20-Poly1305` for encryption (same as private key encryption).
- **Key derivation**: The encryption key is derived from the Evolu mnemonic. The exact derivation is handled by Evolu's internal implementation.
- **Sync endpoints**: Sync happens via WebSocket to `wss://evolu-relay-1.artlu.xyz` (configured in `src/frontend/lib/evolu.ts`).
- **Data at rest**: Private keys are encrypted before being stored in the local SQLite database (using `XChaCha20-Poly1305`). However, the SQLite database file itself is not encrypted at the file system level. If someone gains access to the database file, *e.g.*, by downloading their own data, they would see encrypted private keys (base64-encoded ciphertext), not plaintext keys.

**Risks**:
- If the sync relay is compromised, it could see encrypted data (but not decrypt without the mnemonic)
- The relay operator could potentially perform traffic analysis on local-first sync traffic (incremental updates in CRDT form)
- If the device is compromised and the database file is accessed, the attacker would see encrypted keys. To decrypt them, they would need the owner's encryption key (derived from the Evolu mnemonic). However, if both the database and the mnemonic are compromised, keys are accessible

**Recommendation**: Document that sync relays are self-hosted and the trust model. Consider relevance of database-level encryption for other sensitive data.

## Memory Safety

**Are private keys and sensitive data properly cleared from memory? Are there any timing attacks or side-channel vulnerabilities?**

Memory handling has limitations due to JavaScript:

- **Byte arrays**: Decrypted private key bytes (Uint8Array) are wiped using `secureWipe()` which fills with zeros (implemented in `crypto.ts`).
- **String limitation**: Private keys as strings cannot be securely wiped (JavaScript strings are immutable). The code acknowledges this limitation.
- **Scope management**: Private keys are scoped to the transaction signing function and go out of scope after use. However, JavaScript's garbage collector timing is non-deterministic.
- **No timing attack protection**: There's no explicit protection against timing attacks (e.g., constant-time comparison for addresses).

**Risks**:
- Private key strings may remain in memory until garbage collection
- No protection against timing attacks (though this may not be critical for this use case)
- Browser extensions or malicious code could potentially read memory

**Recommendation**: Consider using Web Workers for sensitive operations to isolate memory. Document the JavaScript memory limitations.

## Access Control

**Are there any unauthorized access paths to wallet data? Is the local database properly protected? Are file permissions correctly set?**

Access control is handled at the application and browser level:

- **Local database**: Evolu SQLite database is stored in browser IndexedDB (via Evolu's implementation). Browser security model applies (same-origin policy).
- **No authentication**: The application doesn't require user authentication. Anyone with access to the browser/device can access the wallet.
- **No file system access**: The application runs in the browser, so file permissions are handled by the browser. No direct file system access.
- **CORS protection**: Backend API uses CORS middleware (in `backend/index.ts`), but this is for cross-origin requests, not authentication.

**Risks**:
- If someone has physical access to the device, they can access the wallet
- Browser extensions with excessive permissions could potentially access IndexedDB
- No protection against XSS attacks that could steal keys (though React helps)

**Recommendation**: Document that physical device security is the user's responsibility. Consider adding optional password protection for the local database.

## Error Handling

**Do error messages leak sensitive information? Are failures handled securely without exposing internal state?**

Error handling is generally secure:

- **User-facing errors**: Error messages are user-friendly and don't expose internal details (e.g., "Failed to decrypt private key" rather than showing the actual error).
- **Backend errors**: Backend returns structured error objects with codes (e.g., `INVALID_ADDRESS`, `RATE_LIMITED`) rather than stack traces.
- **Console logging**: Some errors are logged to console (e.g., line 182 in `SendForm.tsx`), which could expose information in browser dev tools, but this is standard practice.
- **Exception handling**: Try-catch blocks prevent unhandled exceptions from exposing stack traces to users.

**Potential issues**:
- Console.error() calls could leak information if dev tools are open
- Some error messages might be too generic (e.g., "Unknown error")

**Recommendation**: Review all error messages to ensure they don't leak sensitive information. Consider a production mode that disables console logging.

## Dependencies

**Are all dependencies audited for known vulnerabilities? Are cryptographic libraries used correctly? Are there any supply chain risks?**

Dependencies use well-maintained libraries:

- **Cryptographic libraries**: 
  - `@evolu/common` for encryption (`XChaCha20-Poly1305`)
  - `@scure/bip32` for BIP32 HD key derivation (well-audited, secure alternative to bip32)
  - `@scure/bip39` for BIP39 mnemonic validation and seed generation (well-audited, secure alternative to bip39)
  - `viem` for Ethereum operations (well-audited)
  - `valibot` for validation (lightweight, type-safe)
- **Blockchain libraries**:
  - `tronweb` for Tron blockchain operations (official Tron library)
- **Key dependencies**: React, TypeScript, Hono, TanStack Query - all well-maintained
- **No known issues**: No obviously vulnerable dependencies in the current list

**Risks**:
- Supply chain attacks (compromised npm packages)
- Outdated dependencies with known vulnerabilities
- No automated dependency scanning mentioned

**Recommendation**: 
- Use `npm audit` or similar tools regularly
- Consider using Dependabot or similar for automated updates
- Document the process for updating dependencies
- Pin dependency versions in production

## Backup & Recovery

**Are backup mechanisms secure? Can backups be tampered with? Is the mnemonic phrase generation cryptographically secure?**

Backup and recovery mechanisms:

- **Database export**: Users can export the database via `evolu.exportDatabase()` which returns the SQLite database as an array (line 37 in `OwnerActions.tsx`). This is downloaded as `velvet.db3`.
- **Mnemonic**: The Evolu mnemonic is shown to users and can be used to restore the app owner (and thus access to encrypted keys). The mnemonic generation is handled by Evolu.
- **No backup validation**: There's no validation that exported backups are complete or untampered.
- **Mnemonic security**: Evolu's mnemonic generation should be cryptographically secure (uses `createRandomBytes`), but this depends on Evolu's implementation.

**Risks**:
- Exported database backups are not encrypted (they contain encrypted private keys, but the database itself is not encrypted)
- No integrity checking for backups
- If mnemonic is compromised, all data can be decrypted

**Recommendation**: 
- Document that backups should be stored securely
- Consider adding backup encryption option
- Document the mnemonic security model (Evolu's responsibility)

## Network Security

**Are network requests properly authenticated? Is there protection against rate limiting attacks? Are API keys properly secured?**

Network security implementation:

- **Backend API**: Uses Hono with CORS, CSRF protection, and secure headers (in `backend/index.ts`).
- **No authentication**: The backend API doesn't require authentication - it's a public API. This is by design (anyone can query balances, etc.).
- **API keys**: Etherscan API key is stored in Cloudflare Workers environment variables (not exposed to frontend).
- **Rate limiting**: 
  - Etherscan API has rate limits, and the backend handles `RATE_LIMITED` errors
  - TronGrid API has rate limits, and the backend handles rate limit errors
  - However, there's no client-side rate limiting or backend-level rate limiting
- **CSRF protection**: CSRF middleware is enabled, but since the API is public and doesn't modify user state on the server, this may be less critical.

**Risks**:
- No authentication means anyone can use the API (by design, but could be abused)
- No rate limiting on the backend could allow abuse
- API keys in environment variables are secure, but if Workers are compromised, keys are exposed

**Recommendation**: 
- Consider adding rate limiting to prevent abuse
- Document that the API is intentionally public
- Consider API key rotation procedures

## Code Injection

**Are there any eval() calls or dynamic code execution? Are template strings properly sanitized? Are there XSS vulnerabilities in the UI?**

Code injection protections:

- **No eval()**: No use of `eval()`, `Function()`, or similar dynamic code execution found.
- **React XSS protection**: React automatically escapes content in JSX, preventing XSS in most cases.
- **Template strings**: All template strings use React's JSX, which is safe.
- **User input**: User inputs (addresses, amounts) are validated and rendered through React components, which escape HTML.

**Potential issues**:
- If user-controlled data is rendered as raw HTML (using `dangerouslySetInnerHTML`), XSS is possible, but no such usage found.
- Addresses and other user data are displayed as text, not HTML.

**Recommendation**: 
- Avoid `dangerouslySetInnerHTML` in the future
- Consider using a Content Security Policy (CSP) header
- Regular security audits for XSS vulnerabilities

## Transaction Replay

**Are transactions protected against replay attacks across different chains? Is chain ID properly validated?**

Replay attack protection varies by blockchain:

### EVM Chains (Ethereum, Base)

- **Chain ID in transactions**: All EVM transactions include `chainId` (in `SendForm.tsx`), which prevents replay across different chains (EIP-155 protection).
- **Chain ID validation**: Chain ID is validated on the backend via `validateChainId()` in `src/backend/lib/validation.ts` to ensure only supported chains (1 for Ethereum, 8453 for Base) are accepted.
- **EIP-1559**: Transactions use EIP-1559 format which includes chain ID in the signature, preventing replay across different EVM chains.

**Protection**: EVM transactions are protected against cross-chain replay attacks via EIP-155/EIP-1559.

### Tron

- **Reference block**: Tron transactions include a reference block hash and block number, which provides replay protection within the Tron network.
- **Expiration time**: Tron transactions include an expiration time, preventing replay after expiration.
- **No chain ID**: Tron is a single network, so there's no concept of chain ID. Transactions cannot be replayed on other networks (they're Tron-specific).
- **Transaction ID**: Each Tron transaction has a unique transaction ID (txid) based on the transaction content, preventing duplicate transactions.

**Protection**: Tron transactions are protected against replay within the Tron network via reference block and expiration time.

**Recommendation**: 
- Document that EIP-1559 provides replay protection for EVM chains
- Document that Tron transactions use reference block and expiration for replay protection
- Consider adding explicit chain ID validation in the frontend before signing EVM transactions

## Gas Estimation

**Can gas estimation be manipulated to cause failed transactions or excessive fees? Are gas limits properly validated?**

Gas estimation security varies by blockchain:

### EVM Chains (Ethereum, Base)

- **Backend estimation**: Gas estimates come from the backend API (`/estimate-gas` endpoint) which uses `viem`'s `estimateGas()` function in `src/backend/lib/rpc.ts`.
- **No client-side validation**: There's no explicit validation that gas estimates are reasonable (e.g., checking against maximum acceptable values).
- **Gas limit in transaction**: The estimated gas limit is used directly in the transaction (in `SendForm.tsx`).
- **Fee validation**: `maxFeePerGas` and `maxPriorityFeePerGas` are used from the estimate without additional validation (in `SendForm.tsx`).

**Risks**:
- If the backend is compromised, it could provide malicious gas estimates
- No protection against extremely high gas fees
- No validation that gas estimate is reasonable for the transaction type

### Tron

- **Backend estimation**: Gas estimates come from the backend API (`/estimate-gas/tron` endpoint) which uses TronGrid API for fee estimation in `src/backend/lib/tron/rpc.ts`.
- **Fee model**: Tron uses bandwidth/energy model rather than gas:
  - Native TRX transfers consume bandwidth (free if account has bandwidth)
  - TRC20 transfers consume energy (free if account has energy) or burn TRX
- **Total cost**: Tron gas estimates include `totalCostTrx` which represents the total cost in TRX (line 365 in `SendForm.tsx`).
- **No client-side validation**: There's no explicit validation that Tron fee estimates are reasonable.

**Risks**:
- If the backend is compromised, it could provide malicious fee estimates
- No protection against extremely high fees
- Tron fee estimation relies on TronGrid API accuracy

**Recommendation**: 
- Add client-side validation for maximum acceptable gas limits and fees (EVM)
- Add client-side validation for maximum acceptable total cost (Tron)
- Consider showing gas/fee estimate details to users before signing
- Add warnings for unusually high gas/fee estimates
- Consider implementing fallback fee estimation methods
