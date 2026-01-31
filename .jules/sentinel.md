
## 2026-01-31 - Fail-Open Rate Limiting
**Vulnerability:** The API application would fail open (disable rate limiting entirely) if the external rate-limiter package failed to load. This could leave the API vulnerable to DDoS or brute-force attacks in case of dependency issues or misconfiguration.
**Learning:** Security controls should always fail securely (fail closed) or have a robust fallback mechanism. Relying on a try-catch block that just logs a warning is insufficient for critical security features.
**Prevention:** Implemented a fallback mechanism to use the local in-memory rate limiter if the primary package fails to load. Also added a Disable Drift check to prevent suppression of security checks.
