-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "pending_payout_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "total_earned_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "total_paid_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "wallet_address" VARCHAR(100);

-- AlterTable
ALTER TABLE "clip_votes" ADD COLUMN     "payment_status" VARCHAR(20) NOT NULL DEFAULT 'none',
ADD COLUMN     "payment_tx_hash" VARCHAR(100),
ADD COLUMN     "tip_amount_cents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "tx_hash" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payouts_agent_id_idx" ON "payouts"("agent_id");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE INDEX "payouts_created_at_idx" ON "payouts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "clip_votes_payment_status_idx" ON "clip_votes"("payment_status");
