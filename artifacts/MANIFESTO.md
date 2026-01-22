# Manifesto

## Sovereignty

**Your keys, your data, your sovereignty.**

We believe in digital self-determination. Your private keys never leave your device. Your transaction history lives onchain, and we empower you to securely manage ephemeral addresses, with as much or as little anonymity as desired.

No third party ever holds or has access to your funds. No centralized service can freeze your account[^1]. No corporation can curtail your financial activity.

Sovereignty means you are the sole authority over your assets. We provide the tools; you maintain the power.

## User Choice

**Freedom to choose, freedom to modify, freedom to leave.**

This wallet is open source. You can inspect every line of code. You can fork it, modify it, and run your own version. You can choose which networks to connect to, which RPC providers to use, and which features to enable.

We don't lock you into proprietary protocols. We don't force you to use specific services. We don't require accounts or registrations. Your choices are yours alone.

Simplicity of code paths means that a skilled programmer, human or otherwise, can easily modify and host code to implement the logic inside this app.

## User Ownership

**What's yours stays yours.**

Private keys are stored encrypted in your local SQLite database. They belong to you, on your device, under your control. During sync, data is encrypted in transport using your mnemonic—but at rest, it's yours to manage, backup, and restore as you see fit.

You own your wallet data. You own your backups. We don't store your data in the cloud, although we faciliate cross-platform, multi-device private syncing. We don't analyze your usage patterns. We don't monetize your information.

## Transparency

**Open source, open standards.**

Every feature is implemented in plain sight. Every API call is visible. Every data structure is documented. There are no hidden backdoors, no secret keys, no obscured functionality.

We use open standards: BIP39 for mnemonics, [BIP32/BIP44 for key derivation], EIP-1559 for transactions. We integrate with public RPC endpoints. We follow established cryptographic practices.

You can audit the code. You can verify the behavior. You can trust because you can verify.

---

**Underground Velvet Wallet** is not just software—it's a tool of freedom. A statement that you deserve sovereignty over your digital assets. A statement that user choice matters. A statement that ownership belongs to the user, not the platform. A statement that transparency builds trust. A statement that complexity is unnecessary, and comes with difficult tradeoffs.

*Secure privacy, with a velvety smooth touch.*

---

## Security Audit Questions

When reviewing this codebase for security vulnerabilities, consider discussing with a security advisor and/or an LLM:

1. **Private Key Storage**: How are private keys stored and encrypted? Are they ever exposed in memory longer than necessary? When and how are they removed from memory after use?

2. **Key Derivation**: Are BIP32/BIP44 key derivation paths implemented correctly? Are there any vulnerabilities in the mnemonic phrase generation or validation?

3. **Transaction Signing**: Are transaction signatures generated securely? Is there any risk of nonce reuse or replay attacks? Are gas estimates validated before signing?

4. **Input Validation**: Are all user inputs (addresses, amounts, transaction data) properly validated and sanitized? Are there risks of injection attacks or malformed data?

5. **RPC Endpoint Security**: How are RPC endpoints validated? Are there risks of man-in-the-middle attacks or malicious RPC providers? Is certificate pinning implemented?

6. **Sync Security**: How is data encrypted during sync? Is the encryption key derivation secure? Are there risks of data leakage during synchronization?

7. **Memory Safety**: Are private keys and sensitive data properly cleared from memory? Are there any timing attacks or side-channel vulnerabilities?

8. **Access Control**: Are there any unauthorized access paths to wallet data? Is the local database properly protected? Are file permissions correctly set?

9. **Error Handling**: Do error messages leak sensitive information? Are failures handled securely without exposing internal state?

10. **Dependencies**: Are all dependencies audited for known vulnerabilities? Are cryptographic libraries used correctly? Are there any supply chain risks?

11. **Backup & Recovery**: Are backup mechanisms secure? Can backups be tampered with? Is the mnemonic phrase generation cryptographically secure?

12. **Network Security**: Are network requests properly authenticated? Is there protection against rate limiting attacks? Are API keys properly secured?

13. **Code Injection**: Are there any eval() calls or dynamic code execution? Are template strings properly sanitized? Are there XSS vulnerabilities in the UI?

14. **Transaction Replay**: Are transactions protected against replay attacks across different chains? Is chain ID properly validated?

15. **Gas Estimation**: Can gas estimation be manipulated to cause failed transactions or excessive fees? Are gas limits properly validated?

For detailed security analysis and answers to these questions, see [SECURITY.md](../SECURITY.md).


---

[^1]: insofar as progressive chain decentralization + onchain assets sovereignty protect you from asset freezes or seizure