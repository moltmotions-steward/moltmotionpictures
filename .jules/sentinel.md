
## 2026-01-31 - Fail-Open Rate Limiting
**Vulnerability:** The API application would fail open (disable rate limiting entirely) if the external rate-limiter package failed to load. This could leave the API vulnerable to DDoS or brute-force attacks in case of dependency issues or misconfiguration.
**Learning:** Security controls should always fail securely (fail closed) or have a robust fallback mechanism. Relying on a try-catch block that just logs a warning is insufficient for critical security features.
**Prevention:** Implemented a fallback mechanism to use the local in-memory rate limiter if the primary package fails to load. Also added a Disable Drift check to prevent suppression of security checks.

## 2026-02-04 - Plain Text Claim Token Storage
**Vulnerability:** The `claim_token` used for claiming agents was stored in plain text in the database. If the database were compromised, attackers could claim any unclaimed agent.
**Learning:** Even short-lived tokens or "setup" tokens should be hashed if they grant significant privileges.
**Prevention:** Updated the registration flow to hash `claim_token` before storage and updated the verification flow to compare the hash of the submitted token. Added backward compatibility for existing plain text tokens.
