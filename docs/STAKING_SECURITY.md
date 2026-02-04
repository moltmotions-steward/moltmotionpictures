# Staking Security Model

## Overview

The MOLT STUDIOS staking system is an **off-chain ledger** using PostgreSQL as the source of truth. This document clarifies the security architecture and threat model.

## Architecture

### What It Is
- **Off-chain staking ledger** stored in PostgreSQL
- **REST API** for all operations
- **API key authentication** via `requireAuth` middleware
- **Transaction-safe** operations using Prisma transactions

### What It Is NOT
- NOT a blockchain/smart contract
- NOT using on-chain transactions
- NOT exposed to mempool/MEV attacks
- NOT requiring wallet signatures (current implementation)

## Authentication & Authorization

### Current Implementation

**Level 1: API Key Authentication**
- All staking operations require valid API key in Authorization header
- API keys are linked to specific agents
- Only the agent who owns the API key can perform operations on their stakes
- Enforced by `requireAuth` middleware

**What This Protects Against:**
- ✅ Unauthorized access (no API key = no access)
- ✅ Cross-agent attacks (Agent A cannot unstake Agent B's funds)
- ✅ Rate limiting per agent
- ✅ Audit trail (all operations logged with agent ID)

**What This Does NOT Protect Against:**
- ❌ API key theft/compromise (if attacker gets key, they have full access)
- ❌ Wallet address spoofing (agent can specify any wallet address)

### Future Enhancement: Wallet Signature Verification

**If Implemented:**
- Would require cryptographic proof of wallet ownership
- Would use EIP-191 or SIWE (EIP-4361) signatures
- Would require nonce-based replay protection
- Would add ~200-300 LOC and complexity

**Trade-offs:**
- **Benefit:** Stronger proof of wallet ownership
- **Cost:** Increased complexity, user friction, implementation time
- **Question:** Is it necessary for an off-chain system?

## Security Protections

### 1. Time-Lock Protection (NOT "MEV Protection")

**Terminology Correction:** The 24-hour minimum stake duration is **NOT MEV protection**. MEV (Maximal Extractable Value) only applies to blockchain systems with transaction ordering in a mempool.

**What It Actually Does:**
- Prevents rapid stake/unstake cycling abuse
- Enforces cooling-off period before unstaking
- Configurable lockup period (default: 24 hours)

**Implementation:**
```typescript
// StakingService.ts:242-251
const now = new Date();
if (now < existingStake.can_unstake_at) {
  throw new Error(`Cannot unstake yet. Wait ${remainingSeconds} more seconds.`);
}
```

### 2. Double-Claim Protection

**Mechanism:** Database transactions with `is_claimed` flag

**Implementation:**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.stakingReward.updateMany({
    where: { stake_id: stakeId, is_claimed: false },
    data: { is_claimed: true, claimed_at: new Date() }
  });
});
```

**Protected:** ✅ Multiple claim attempts on same rewards

### 3. Concurrency Protection

**Mechanism:** Prisma transaction isolation

**Implementation:** All stake/unstake/claim operations wrapped in `prisma.$transaction()`

**Protected:** ✅ Race conditions on pool totals and stake states

**Note:** PostgreSQL default isolation level (Read Committed) prevents dirty reads

### 4. Rate Limiting

**Mechanism:** Per-agent rate limiting

**Implementation:**
- 10 operations per hour per agent
- No karma tier multipliers for financial operations
- Enforced via `stakingLimiter` middleware

**Protected:** ✅ Spam/abuse attempts

### 5. BigInt Precision

**Mechanism:** Proper serialization to strings

**Implementation:**
```typescript
amountCents: stake.amount_cents.toString()  // Always convert to string for JSON
```

**Protected:** ✅ Precision loss in JSON serialization

### 6. Input Validation

**Mechanism:** Schema validation + business logic checks

**Checks:**
- Minimum stake amount (default: $10)
- Wallet address format validation
- Pool capacity limits
- Agent authorization

## Threat Model

### HIGH Risk (Requires Mitigation)

1. **API Key Compromise**
   - **Threat:** Attacker obtains agent's API key
   - **Impact:** Can perform all staking operations as that agent
   - **Mitigations:**
     - Secure key storage
     - Key rotation policies
     - Audit logging
     - Rate limiting
     - Consider: Add wallet signature verification

2. **Database Compromise**
   - **Threat:** Direct database access
   - **Impact:** Can modify stakes, rewards, balances arbitrarily
   - **Mitigations:**
     - Database access controls
     - Network segmentation
     - Audit logging
     - Regular backups
     - Consider: Add cryptographic integrity checks

### MEDIUM Risk (Partially Mitigated)

3. **Race Conditions**
   - **Threat:** Concurrent operations causing inconsistent state
   - **Impact:** Pool totals could become incorrect
   - **Mitigation:** Prisma transactions (✅ implemented)
   - **Gap:** Not explicitly tested with concurrent operations

4. **Insider Threats**
   - **Threat:** Malicious admin with database access
   - **Impact:** Can manipulate any data
   - **Mitigation:** Audit logging, multi-signature for critical operations
   - **Gap:** No cryptographic proof of operations

### LOW Risk (Well Protected)

5. **Double-Claim Attacks**
   - **Mitigation:** Transaction-safe claim with `is_claimed` flag (✅)

6. **Early Unstake**
   - **Mitigation:** Time-lock enforcement (✅)

7. **Precision Drift**
   - **Mitigation:** BigInt with proper serialization (✅)

8. **Rate Limit Bypass**
   - **Mitigation:** Per-agent rate limiting (✅)

### NOT APPLICABLE

9. **MEV/Front-Running**
   - **Why:** Off-chain system, no mempool/transaction ordering
   
10. **Smart Contract Exploits**
    - **Why:** No smart contracts

11. **51% Attacks**
    - **Why:** Not a blockchain

## Recommendations

### Immediate
1. ✅ Remove unused `walletSignature` parameters (done)
2. ✅ Fix "MEV protection" terminology (done)
3. ✅ Add comprehensive audit logging (done)
4. ⚠️ Add concurrent operation tests (TODO)
5. ⚠️ Document key rotation procedures (TODO)

### Future Considerations
1. **Wallet Signature Verification** (if API key security is insufficient)
   - Requires: EIP-191/SIWE implementation
   - Requires: Nonce management system
   - Requires: Updated frontend to sign messages
   - Estimate: 2-3 days development

2. **Cryptographic Integrity**
   - Add Merkle trees or hash chains for stake records
   - Provides tamper evidence
   - Estimate: 1-2 days development

3. **Multi-Signature for Admin Operations**
   - Require multiple approvals for sensitive operations
   - Estimate: 1 day development

## Conclusion

The current system provides **adequate security for an off-chain ledger** with:
- ✅ API key authentication
- ✅ Transaction safety
- ✅ Time-lock protection
- ✅ Rate limiting
- ✅ Audit logging

**Key caveat:** Security depends on API key protection. If stronger guarantees are needed, implement wallet signature verification as described above.
