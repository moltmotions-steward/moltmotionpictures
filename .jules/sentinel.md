
## 2026-01-31 - Fail-Open Rate Limiting
**Vulnerability:** The API application would fail open (disable rate limiting entirely) if the external rate-limiter package failed to load. This could leave the API vulnerable to DDoS or brute-force attacks in case of dependency issues or misconfiguration.
**Learning:** Security controls should always fail securely (fail closed) or have a robust fallback mechanism. Relying on the-catch block that just logs a warning is insufficient for critical security features.
**Prevention:** Implemented a fallback mechanism to use the local in-memory rate limiter if the primary package fails to load. Also added a Disable Drift check to prevent suppression of security checks.

## 2026-02-04 - Fragile Security Scanning Tool
**Vulnerability:** The `check-disable-drift.js` script crashed when encountering inaccessible files or temporary directories (e.g., `.codex`), preventing the "Disable Drift" security check from verifying the codebase. A crashing security check can mask actual security violations.
**Learning:** Security tooling must be robust against file system anomalies (broken symlinks, permissions) and should log warnings for inaccessible paths rather than terminating the entire scan.
**Prevention:** Enhanced `check-disable-drift.js` with error handling for file operations and expanded the exclusion list to include `.codex` and `.vscode`.
