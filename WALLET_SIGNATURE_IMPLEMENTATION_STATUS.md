# Wallet Signature Verification Implementation Status

## MANDATE
User has confirmed wallet signature verification is **MANDATORY** for the off-chain staking system.

## Implementation Started (Partial)

### ✅ Completed Files

1. **Prisma Schema** (`api/prisma/schema.prisma`)
   - Added `WalletNonce` model for replay protection
   - Includes: subject_type, subject_id, wallet_address, nonce, expires_at, consumed_at
   - Unique constraint on (subject_type, subject_id, nonce)
   - Proper indexes for performance

2. **Migration** (`api/prisma/migrations/20260204200000_add_wallet_nonces/migration.sql`)
   - SQL to create wallet_nonces table
   - All indexes created
   - **Status**: Additive only, no destructive changes

3. **WalletSignatureService** (`api/src/services/WalletSignatureService.ts`)
   - `generateNonce()` - Creates nonce with 5-minute expiration
   - `createSignatureMessage()` - Formats message for EIP-191 signing
   - `formatMessageForSigning()` - Human-readable message format
   - `verifySignature()` - Verifies signature and marks nonce as consumed
   - `verifyAgentWalletOwnership()` - Ensures signature matches stored wallet
   - `cleanupExpiredNonces()` - Housekeeping function

4. **StakingService** (`api/src/services/StakingService.ts`) - PARTIALLY UPDATED
   - Updated interfaces to require `signature` and `message` parameters
   - Updated `stake()` function to verify signature before processing
   - Import of WalletSignatureService added

### ⚠️ Remaining Work (Critical)

#### API Layer Updates Needed

1. **Nonce Endpoint** (`api/src/routes/auth.ts` or `api/src/routes/staking.ts`)
   ```typescript
   // GET /api/v1/auth/nonce or /api/v1/staking/nonce
   router.get('/nonce', requireAuth, async (req, res) => {
     const { walletAddress, operation } = req.query;
     const nonce = await WalletSignatureService.generateNonce({
       subjectType: 'agent',
       subjectId: req.agent!.id,
       walletAddress: walletAddress as string,
       operation: operation as string
     });
     res.json({ success: true, nonce });
   });
   ```

2. **Update Staking Routes** (`api/src/routes/staking.ts`)
   - POST /stake - Extract signature and message from request body
   - POST /unstake - Extract signature and message from request body  
   - POST /claim - Extract signature and message from request body
   - Parse and validate signature message structure
   - Pass to service layer

3. **Update UnstakeParams Interface**
   - Add signature and message to ClaimParams (already done in StakingService.ts)
   - Update unstake() function to verify signature
   - Update claim() function (if not done) to verify signature

#### Service Layer Completion

1. **StakingService.unstake()** - Add signature verification at start
2. **StakingService.claimRewards()** - Add signature verification at start

#### Test Implementation (20+ tests needed)

1. **Layer 0 Tests** (`api/test/layer0/wallet-signature-logic.test.ts`)
   - Message formatting tests
   - Signature recovery tests
   - Nonce generation tests
   - Expiration logic tests

2. **Layer 1 Tests** (`api/test/layer1/wallet-signature-service.test.ts`)
   - generateNonce() with real DB
   - verifySignature() with ethers
   - verifyAgentWalletOwnership() with real agent
   - Replay attack test (reuse consumed nonce - should fail)
   - Expired nonce test (should fail)
   - Wrong wallet signature test (should fail)

3. **Layer 1 Tests** (`api/test/layer1/staking-signature.test.ts`)
   - Stake with valid signature (should succeed)
   - Stake with invalid signature (should fail)
   - Stake with expired nonce (should fail)
   - Stake with consumed nonce (should fail)
   - Unstake with valid signature (should succeed)
   - Claim with valid signature (should succeed)

4. **Concurrency Tests** (`api/test/layer1/staking-concurrent.test.ts`)
   - Parallel stake operations
   - Parallel unstake attempts on same stake
   - Parallel nonce generation

5. **Rate Limit Tests** (`api/test/layer1/staking-rate-limit.test.ts`)
   - 10 operations succeed
   - 11th operation blocked
   - Verify 429 response

#### Documentation Updates

1. Update `docs/STAKING_API.md` - Document new signature requirements
2. Update `docs/STAKING_SECURITY.md` - Remove "optional" language
3. Add `docs/WALLET_SIGNATURE_GUIDE.md` - Frontend integration guide
4. Update PR description with mandatory signature requirement

## Frontend Integration Requirements

Frontend developers will need to:

1. **Request Nonce**
   ```javascript
   const response = await fetch('/api/v1/staking/nonce?walletAddress=0x...&operation=stake');
   const { nonce, issuedAt, expiresAt } = await response.json();
   ```

2. **Create Message**
   ```javascript
   const message = {
     domain: 'molt.studio',
     subjectType: 'agent',
     subjectId: agentId,
     walletAddress: walletAddress,
     nonce: nonce,
     issuedAt: issuedAt,
     expiresAt: expiresAt,
     chainId: 8453,
     operation: 'stake'
   };
   ```

3. **Sign Message** (using ethers or wagmi)
   ```javascript
   const formattedMessage = formatMessageForDisplay(message);
   const signature = await signer.signMessage(formattedMessage);
   ```

4. **Send to API**
   ```javascript
   await fetch('/api/v1/staking/stake', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${apiKey}` },
     body: JSON.stringify({
       poolId,
       amountCents,
       walletAddress,
       signature,
       message
     })
   });
   ```

## Estimated Remaining Effort

- **API Routes**: 2-3 hours
- **Service Layer Completion**: 1 hour  
- **Test Implementation**: 6-8 hours
- **Documentation**: 2 hours
- **Frontend Integration Support**: 2-3 hours

**Total**: 13-17 hours of focused development

## Blocker

The current CI environment cannot run tests due to:
- Missing DATABASE_URL
- Rollup binary dependency issues
- No Docker Compose setup in CI

**Recommendation**: Complete implementation locally with docker-compose.test.yml, then configure CI pipeline.

## Next Immediate Steps

1. Add nonce endpoint to routes
2. Update staking routes to accept signature + message
3. Complete unstake() and claimRewards() signature verification
4. Generate Prisma client with new WalletNonce model
5. Build and verify TypeScript compilation
6. Write and run signature verification tests
7. Update documentation

## Files Modified So Far

- `api/prisma/schema.prisma` - Added WalletNonce model
- `api/prisma/migrations/20260204200000_add_wallet_nonces/migration.sql` - New migration
- `api/src/services/WalletSignatureService.ts` - New service (COMPLETE)
- `api/src/services/StakingService.ts` - Updated stake() function (PARTIAL)

## Files Still Need Changes

- `api/src/routes/staking.ts` - Add signature handling
- `api/src/routes/auth.ts` or separate nonce route - Add nonce endpoint
- `api/src/services/StakingService.ts` - Update unstake() and claimRewards()
- `api/test/layer0/wallet-signature-logic.test.ts` - NEW
- `api/test/layer1/wallet-signature-service.test.ts` - NEW
- `api/test/layer1/staking-signature.test.ts` - NEW
- `api/test/layer1/staking-concurrent.test.ts` - NEW
- `api/test/layer1/staking-rate-limit.test.ts` - NEW
- `docs/STAKING_API.md` - Update with signature flow
- `docs/WALLET_SIGNATURE_GUIDE.md` - NEW
