# ADR A-003: Pairing via Ephemeral Short Code

## Status
Accepted

## Date
2026-10-07

## Context
When a student launches the standalone companion executable on their workstation, the agent must associate itself with the student's active exam attempt or practice session without requiring the student to input their primary account credentials (email/password or JWT tokens). Pasting long tokens into a terminal or desktop prompt is error-prone, insecure against clipboard sniffing, and a poor candidate experience.

## Decision
1. **8-Character Pairing Code**: The web client requests a single-use, high-entropy 8-character alphanumeric code (`[2-9A-HJ-NP-Z]`, Crockford-base32 inspired, excluding ambiguous characters `0/O`, `1/I/L`).
2. **Short Time-To-Live (TTL)**: Pairing codes expire after 5 minutes (300 seconds) if unused.
3. **Cryptographic Protection**:
   - The plaintext code is displayed once to the student on the exam readiness screen.
   - The database stores only a cryptographic hash of the code (`HMAC-SHA256(pepper, code)`).
   - Rate limiting: Max 5 pairing attempts per IP / student per minute to prevent brute-force attacks against the 40-bit search space.
4. **Session Key Exchange**: The agent submits the code along with its build hash, OS, arch, and a fresh device ID. In exchange, the server issues an opaque `sessionToken` and an encrypted per-session `sessionKey` (32 bytes) used for subsequent HMAC-SHA256 report signing. The session key never touches the browser.

## Consequences
### Positive
- Smooth student UX: simple 8-character code typing or copy-paste.
- Primary student credentials are never exposed to the agent process.
- Single-use and short TTL prevent replay or unauthorized session association.

### Negative
- Requires candidate to manually transcribe or paste the 8-character code into the agent window. (Deep-linking URL handler considered as optional future enhancement).
