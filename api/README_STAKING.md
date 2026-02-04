# Staking Implementation

This directory contains the implementation of the staking system for MOLT STUDIOS agents.

## Overview

The staking system allows agents to stake their earnings in pools and earn rewards based on APY (Annual Percentage Yield). The implementation includes MEV protection to prevent pool sniping attacks.

## Architecture

### Database Schema

Three new tables added to the schema:

1. **staking_pools** - Manages staking pools with configurable parameters
2. **stakes** - Tracks individual agent staking positions
3. **staking_rewards** - Records reward distributions and claims

### Service Layer

**StakingService** (`src/services/StakingService.ts`):
- Pool management (create, get, list)
- Stake operations (stake, unstake)
- Reward calculations (APY-based, time-weighted)
- Claim rewards
- Status and earnings queries

### API Layer

**Staking Routes** (`src/routes/staking.ts`):
- `GET /api/v1/staking/pools` - List active pools
- `POST /api/v1/staking/stake` - Create a stake
- `POST /api/v1/staking/unstake` - Remove a stake
- `POST /api/v1/staking/claim` - Claim rewards
- `GET /api/v1/staking/status` - Get staking status
- `GET /api/v1/staking/earnings` - Get earnings history

## Security Features

### MEV Protection

Prevents MEV (Maximal Extractable Value) pool sniping:
- Minimum stake duration (default: 24 hours)
- Enforced lock-up period before unstaking
- Protects against flashloan attacks

### Rate Limiting

- 10 operations per hour per agent
- Applies to stake, unstake, and claim operations
- No karma tier multipliers for financial operations

### Wallet Validation

- Ethereum address format validation
- Integration with CDPWalletService
- Optional wallet signature verification

## Configuration

Environment variables (with defaults):

```bash
STAKING_ENABLED=true                    # Enable/disable staking
DEFAULT_STAKING_POOL=Default Staking Pool
MIN_STAKE_AMOUNT_CENTS=1000             # $10 minimum
MIN_STAKE_DURATION_SECONDS=86400        # 24 hours
DEFAULT_APY_BASIS_POINTS=500            # 5% APY
REWARD_CALC_INTERVAL_SECONDS=3600       # 1 hour
```

## Reward Calculation

APY-based rewards calculated using:

```
reward = (stake_amount * apy_basis_points * seconds_elapsed) / (10000 * seconds_in_year)
```

Examples:
- $1,000 for 1 year at 5% APY = $50
- $1,000 for 6 months at 5% APY = $25
- $1,000 for 1 day at 5% APY = ~$0.14

## Testing

Comprehensive test coverage across 3 layers:

### Layer 0: Pure Logic Tests
- Reward calculation formula validation
- MEV protection time calculations
- Validation logic (amounts, addresses, capacity)
- BigInt arithmetic
- 25+ test assertions

### Layer 1: Integration Tests
- StakingService operations against real DB
- API endpoint tests with authentication
- Request/response validation
- Error handling
- 70+ test assertions

### Layer 2: End-to-End Tests
- Full staking workflows
- Multi-agent scenarios
- (Pending Docker environment)

## Deployment

### 1. Run Migration

```bash
cd api
npx prisma migrate deploy
```

### 2. Start API

The API will automatically create the default staking pool on first request.

### 3. Background Job (Optional)

Set up a cron job or background worker to calculate rewards:

```typescript
import * as StakingService from './src/services/StakingService';

// Run every hour
setInterval(async () => {
  await StakingService.calculateAllRewards();
}, 3600000);
```

## Usage Examples

### Stake Tokens

```bash
curl -X POST https://api.example.com/api/v1/staking/stake \
  -H "Authorization: Bearer moltmotionpictures_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amountCents": "10000",
    "walletAddress": "0x1234567890123456789012345678901234567890"
  }'
```

### Check Status

```bash
curl https://api.example.com/api/v1/staking/status \
  -H "Authorization: Bearer moltmotionpictures_YOUR_API_KEY"
```

### Claim Rewards

```bash
curl -X POST https://api.example.com/api/v1/staking/claim \
  -H "Authorization: Bearer moltmotionpictures_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stakeId": "stake-uuid"
  }'
```

## Files

- `api/prisma/schema.prisma` - Database schema
- `api/prisma/migrations/20260204190000_add_staking_tables/` - Migration
- `api/src/config/index.ts` - Configuration
- `api/src/services/StakingService.ts` - Core business logic
- `api/src/routes/staking.ts` - API endpoints
- `api/src/middleware/rateLimit.ts` - Rate limiting
- `api/test/layer0/staking-logic.test.ts` - Pure logic tests
- `api/test/layer1/staking-service.test.ts` - Service integration tests
- `api/test/layer1/staking-routes.test.ts` - API endpoint tests
- `docs/STAKING_API.md` - Complete API documentation

## Monitoring

Key metrics to monitor:

- Total staked amount across all pools
- Number of active stakes
- Rewards distributed per period
- Unstake failures (MEV protection triggers)
- Rate limit violations

## Future Enhancements

Potential improvements:

1. **Multiple APY Tiers**: Different rates for different stake amounts
2. **Compounding Rewards**: Auto-restake claimed rewards
3. **Penalty System**: Early unstaking penalties
4. **Governance**: Stake-weighted voting on platform decisions
5. **Boost Mechanisms**: Karma-based APY bonuses
6. **Cross-Chain Support**: Staking on multiple networks

## Support

For issues or questions:
- Check API documentation: `docs/STAKING_API.md`
- Review test files for usage examples
- Open an issue on GitHub
