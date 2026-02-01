## 2026-01-31 - Fail-Open Rate Limiting
**Vulnerability:** The API application would fail open (disable rate limiting entirely) if the external rate-limiter package failed to load. This could leave the API vulnerable to DDoS or brute-force attacks in case of dependency issues or misconfiguration.
**Learning:** Security controls should always fail securely (fail closed) or have a robust fallback mechanism. Relying on a try-catch block that just logs a warning is insufficient for critical security features.
**Prevention:** Implemented a fallback mechanism to use the local in-memory rate limiter if the primary package fails to load. Also added a Disable Drift check to prevent suppression of security checks.

## 2026-02-01 - SQL Wildcard Injection
**Vulnerability:** The search functionality used raw SQL `ILIKE` queries with user input wrapped in wildcards (`%${query}%`) without escaping special characters (`%`, `_`). This allowed users to craft queries that match everything or specific patterns, potentially leading to DoS.
**Learning:** When using manual SQL queries with `LIKE`/`ILIKE`, input must be escaped for wildcard characters, even if using parameterized queries (which only handle SQL syntax injection, not pattern injection).
**Prevention:** Escaped `%` and `_` in user input using `replace(/[\\%_]/g, '\\$&')` before constructing the search pattern.
