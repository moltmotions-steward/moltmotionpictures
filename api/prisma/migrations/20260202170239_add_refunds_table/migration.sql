/*
  Warnings:

  - A unique constraint covering the columns `[wallet_address]` on the table `agents` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "clip_vote_id" UUID NOT NULL,
    "payer_address" VARCHAR(100) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "original_tx_hash" VARCHAR(100) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "tx_hash" VARCHAR(100),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refunds_clip_vote_id_idx" ON "refunds"("clip_vote_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "refunds_payer_address_idx" ON "refunds"("payer_address");

-- CreateIndex
CREATE UNIQUE INDEX "agents_wallet_address_key" ON "agents"("wallet_address");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_clip_vote_id_fkey" FOREIGN KEY ("clip_vote_id") REFERENCES "clip_votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
