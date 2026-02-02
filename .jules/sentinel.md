
## 2026-01-31 - Fail-Open Rate Limiting
**Vulnerability:** The API application would fail open (disable rate limiting entirely) if the external rate-limiter package failed to load. This could leave the API vulnerable to DDoS or brute-force attacks in case of dependency issues or misconfiguration.
**Learning:** Security controls should always fail securely (fail closed) or have a robust fallback mechanism. Relying on a try-catch block that just logs a warning is insufficient for critical security features.
**Prevention:** Implemented a fallback mechanism to use the local in-memory rate limiter if the primary package fails to load. Also added a Disable Drift check to prevent suppression of security checks.

## 2026-02-02 - Rate Limiter Memory Exhaustion
**Vulnerability:** The in-memory rate limiter store (`MemoryStore`) allowed unbounded key storage. An attacker could flood the service with requests using random keys (e.g., spoofed IPs via `X-Forwarded-For`), causing the `Map` to grow indefinitely until the server crashes (DoS via OOM).
**Learning:** In-memory caches and stores must always have a capacity limit and eviction policy to prevent resource exhaustion attacks.
**Prevention:** Added a `maxKeys` limit (default 100,000) to `MemoryStore` with a FIFO eviction policy to bound memory usage.
