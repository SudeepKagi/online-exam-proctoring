# ADR A-007: Code Signing, Trust Model, and Unsigned Pilot Strategy

## Status
Accepted

## Date
2026-10-07

## Context
Operating systems enforce strict security gates against downloaded executable binaries:
- **Windows**: Microsoft Defender SmartScreen displays warnings for unsigned or low-reputation executables ("Windows protected your PC").
- **macOS**: Gatekeeper and Apple Notarization block unsigned binaries ("App cannot be opened because it is from an unidentified developer").
- **Linux**: Requires execute permission (`chmod +x`).

Obtaining EV Code Signing certificates (Windows) and Apple Developer ID enrollment (macOS) requires organizational entity verification, hardware security tokens, and ongoing subscription costs. For development, pilot evaluation, and institutional testing, a decoupled signing strategy is required.

## Decision
1. **Pilot Phase with Transparent Instructions**:
   - Initial pilot builds are shipped **unsigned** (`signed: false` in release manifest).
   - The pre-exam web page provides transparent, illustrated instructions guiding students through standard OS prompts (e.g., Windows "More info → Run anyway"; macOS System Settings → Privacy & Security → "Open Anyway").
2. **Switchable CI Signing Pipeline**:
   - The GitHub Actions build workflow (`.github/workflows/agent-release.yml`) implements switchable signing steps governed by repository secrets:
     - Windows: SignTool / Azure Trusted Signing when credentials exist.
     - macOS: Apple Developer ID Application certificate signing and `notarytool` submission when credentials exist.
   - If secrets are absent, the workflow produces unsigned artifacts without failing the build.
3. **Cryptographic Integrity Independent of OS Signing**:
   - Regardless of OS code signing, the download portal displays cryptographic SHA-256 hashes for all builds.
   - The server enforces that binary hashes submitted during pairing match registered release records (`buildHash ∈ agent_releases`).

## Consequences
### Positive
- Development and pilot testing proceed unblocked without upfront certificate purchasing.
- Smooth transition to enterprise code-signing by simply populating repository secrets.
- Server-side integrity checks prevent spoofed or tampered client binaries even in unsigned environments.

### Negative
- Unsigned binaries during pilot require student awareness to bypass SmartScreen and Gatekeeper warnings.
