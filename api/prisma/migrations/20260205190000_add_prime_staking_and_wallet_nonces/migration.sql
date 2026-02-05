-- CreateTable
CREATE TABLE "prime_agent_bindings" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "portfolio_id" VARCHAR(100) NOT NULL,
    "wallet_id" VARCHAR(100) NOT NULL,
    "access_key" VARCHAR(200) NOT NULL,
    "passphrase_enc" TEXT NOT NULL,
    "signing_key_enc" TEXT NOT NULL,
    "last_reconciled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "prime_agent_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prime_staking_operations" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "portfolio_id" VARCHAR(100) NOT NULL,
    "wallet_id" VARCHAR(100) NOT NULL,
    "asset" VARCHAR(20) NOT NULL DEFAULT 'ETH',
    "operation_type" VARCHAR(20) NOT NULL,
    "amount_wei" BIGINT,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "prime_activity_id" VARCHAR(200),
    "prime_transaction_id" VARCHAR(200),
    "status" VARCHAR(30) NOT NULL DEFAULT 'initiated',
    "error_message" TEXT,
    "prime_request" JSONB,
    "prime_response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "prime_staking_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prime_reward_events" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "portfolio_id" VARCHAR(100) NOT NULL,
    "wallet_id" VARCHAR(100) NOT NULL,
    "asset" VARCHAR(20) NOT NULL DEFAULT 'ETH',
    "amount_wei" BIGINT NOT NULL,
    "prime_transaction_id" VARCHAR(200) NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "raw" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prime_reward_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_nonces" (
    "id" UUID NOT NULL,
    "subject_type" VARCHAR(20) NOT NULL,
    "subject_id" UUID NOT NULL,
    "wallet_address" VARCHAR(100) NOT NULL,
    "nonce" VARCHAR(64) NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "operation" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prime_agent_bindings_agent_id_key" ON "prime_agent_bindings"("agent_id");

-- CreateIndex
CREATE INDEX "prime_agent_bindings_portfolio_id_idx" ON "prime_agent_bindings"("portfolio_id");

-- CreateIndex
CREATE INDEX "prime_agent_bindings_wallet_id_idx" ON "prime_agent_bindings"("wallet_id");

-- CreateIndex
CREATE INDEX "prime_staking_operations_agent_id_idx" ON "prime_staking_operations"("agent_id");

-- CreateIndex
CREATE INDEX "prime_staking_operations_portfolio_id_idx" ON "prime_staking_operations"("portfolio_id");

-- CreateIndex
CREATE INDEX "prime_staking_operations_wallet_id_idx" ON "prime_staking_operations"("wallet_id");

-- CreateIndex
CREATE INDEX "prime_staking_operations_status_idx" ON "prime_staking_operations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "prime_staking_operations_agent_id_operation_type_idempotency_key_key" ON "prime_staking_operations"("agent_id", "operation_type", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "prime_reward_events_prime_transaction_id_key" ON "prime_reward_events"("prime_transaction_id");

-- CreateIndex
CREATE INDEX "prime_reward_events_agent_id_idx" ON "prime_reward_events"("agent_id");

-- CreateIndex
CREATE INDEX "prime_reward_events_occurred_at_idx" ON "prime_reward_events"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_nonces_subject_type_subject_id_nonce_key" ON "wallet_nonces"("subject_type", "subject_id", "nonce");

-- CreateIndex
CREATE INDEX "wallet_nonces_subject_type_subject_id_idx" ON "wallet_nonces"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "wallet_nonces_wallet_address_idx" ON "wallet_nonces"("wallet_address");

-- CreateIndex
CREATE INDEX "wallet_nonces_expires_at_idx" ON "wallet_nonces"("expires_at");

-- CreateIndex
CREATE INDEX "wallet_nonces_consumed_at_idx" ON "wallet_nonces"("consumed_at");

-- AddForeignKey
ALTER TABLE "prime_agent_bindings" ADD CONSTRAINT "prime_agent_bindings_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prime_staking_operations" ADD CONSTRAINT "prime_staking_operations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prime_reward_events" ADD CONSTRAINT "prime_reward_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

