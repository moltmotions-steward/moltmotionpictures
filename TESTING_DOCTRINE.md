# uSpeaks Testing Doctrine

## 0. Purpose

This document defines the uSpeaks testing doctrine and how it applies across all repositories and services.

**Goals:**
*   Eliminate false confidence from mocked dependencies.
*   Make tests falsifiable in the real world.
*   Attach numeric, measurable expectations to system behaviour.
*   Keep the distinction between pure logic tests and real-surface tests crystal clear.

This applies to all code at uSpeaks: backend services, frontends, CLIs, infrastructure code, data pipelines, and integrations.

## 1. Core Principles

### 1.1 Real-Surface Testing Doctrine

At uSpeaks:

1.  **No simulated access where real access exists.**
    If we own or have credentials for a service (API, database, message queue, object store, blockchain node, etc.), tests that depend on it must hit a **real instance** (test, staging, local dev environment, or official emulator).

2.  **We do not mock or fake that access at the client/SDK/driver boundary.**

3.  **Unit tests are for pure logic only.**
    Unit tests exercise pure computation and transformation (no network, no disk, no time-dependent global state).

4.  **Integration over Mocking.**
    Any module that touches external IO is not unit-tested via mocks of that IO. It is tested through integration/system tests against a real dependency.

5.  **Every test asserts something numeric.**
    Tests do more than “did not throw”. They assert on counts, deltas, and thresholds: number of records, response sizes, time bounds, error rates, etc.

6.  **Tests must be falsifiable in real conditions.**
    A passing test means: “We made a real call, got a real response from a real system, and the measured behaviour stayed within defined bounds.”

7.  **Capacity decisions are based on measurements, not speculation.**
    Any claim about throughput, latency, or scaling must come from measured results of tests executed against real environments, not mocked scenarios.

## 2. Test Taxonomy

uSpeaks standardizes tests into four layers. Every test suite must classify tests into one of these layers.

### 2.1 Layer 0 — Pure Logic (Unit Tests)

**Scope:**
Pure functions and modules with no external side effects:
*   data transformations
*   parsing / formatting
*   validation
*   business rules that operate only on in-memory data structures
*   deterministic algorithms

**Rules:**
*   No network, no filesystem, no environment-dependent global state.
*   No mocks of external services (there are none in this layer).
*   Must be fast and highly parallelizable.

**Expectations:**
*   High coverage on core logic.
*   Tests assert deterministic, numeric properties (array sizes, numeric deltas, value ranges, etc.).

### 2.2 Layer 1 — Integration by Surface

**Scope:**
Tests that exercise one external surface at a time:
*   a single HTTP API
*   a single database
*   a single message queue / topic
*   a single storage bucket
*   a single blockchain endpoint
*   a single external provider

**Rules:**
*   The client used in the test is the same client used in production, pointed at a dedicated test/staging/dev environment.
*   No mocking of HTTP clients, SDKs, drivers, or connection objects for services we can actually reach.
*   Focus on the contract at the boundary: request shape, response shape, status codes, basic latency expectations.

**Example:**
```python
test "create entity and read it back via real service":
  response = http_client.POST("/entities", body={...})
  assert response.status_code == 201
  entity_id = response.json.id
  entity = db_client.fetch("SELECT * FROM entities WHERE id = ?", entity_id)
  assert entity is not null
  assert entity.owner == expected_owner
```
