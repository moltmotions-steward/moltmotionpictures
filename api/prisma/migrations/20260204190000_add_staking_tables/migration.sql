-- CreateTable: StakingPool
CREATE TABLE "staking_pools" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "min_stake_amount_cents" BIGINT NOT NULL DEFAULT 1000,
    "min_stake_duration_seconds" INTEGER NOT NULL DEFAULT 86400,
    "apy_basis_points" INTEGER NOT NULL DEFAULT 500,
    "max_total_stake_cents" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "total_staked_cents" BIGINT NOT NULL DEFAULT 0,
    "total_stakes_count" INTEGER NOT NULL DEFAULT 0,
    "total_rewards_paid_cents" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staking_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Stake
CREATE TABLE "stakes" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "wallet_address" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "earned_rewards_cents" BIGINT NOT NULL DEFAULT 0,
    "claimed_rewards_cents" BIGINT NOT NULL DEFAULT 0,
    "last_reward_calc_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stake_tx_hash" VARCHAR(100),
    "unstake_tx_hash" VARCHAR(100),
    "can_unstake_at" TIMESTAMPTZ NOT NULL,
    "staked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unstaked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StakingReward
CREATE TABLE "staking_rewards" (
    "id" UUID NOT NULL,
    "stake_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "is_claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimed_at" TIMESTAMPTZ,
    "claim_tx_hash" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staking_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staking_pools_is_active_idx" ON "staking_pools"("is_active");
CREATE INDEX "staking_pools_is_default_idx" ON "staking_pools"("is_default");

-- CreateIndex
CREATE INDEX "stakes_agent_id_idx" ON "stakes"("agent_id");
CREATE INDEX "stakes_pool_id_idx" ON "stakes"("pool_id");
CREATE INDEX "stakes_status_idx" ON "stakes"("status");
CREATE INDEX "stakes_wallet_address_idx" ON "stakes"("wallet_address");
CREATE INDEX "stakes_can_unstake_at_idx" ON "stakes"("can_unstake_at");

-- CreateIndex
CREATE INDEX "staking_rewards_stake_id_idx" ON "staking_rewards"("stake_id");
CREATE INDEX "staking_rewards_agent_id_idx" ON "staking_rewards"("agent_id");
CREATE INDEX "staking_rewards_is_claimed_idx" ON "staking_rewards"("is_claimed");
CREATE INDEX "staking_rewards_period_end_idx" ON "staking_rewards"("period_end");

-- AddForeignKey
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "staking_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staking_rewards" ADD CONSTRAINT "staking_rewards_stake_id_fkey" FOREIGN KEY ("stake_id") REFERENCES "stakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
