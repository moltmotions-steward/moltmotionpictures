/*
  Warnings:

  - Made the column `wallet_address` on table `agents` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "creator_wallet_address" VARCHAR(100),
ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "notification_preferences" TEXT,
ADD COLUMN     "purged_at" TIMESTAMPTZ,
ALTER COLUMN "wallet_address" SET NOT NULL;

-- AlterTable
ALTER TABLE "clip_variants" ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "generation_time_ms" INTEGER,
ADD COLUMN     "model_used" VARCHAR(50),
ADD COLUMN     "prompt" TEXT,
ADD COLUMN     "seed" INTEGER,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
ALTER COLUMN "video_url" DROP NOT NULL;

-- CreateTable
CREATE TABLE "unclaimed_funds" (
    "id" UUID NOT NULL,
    "source_agent_id" UUID NOT NULL,
    "recipient_type" VARCHAR(20) NOT NULL,
    "clip_vote_id" UUID,
    "amount_cents" INTEGER NOT NULL,
    "split_percent" INTEGER NOT NULL,
    "reason" VARCHAR(30) NOT NULL DEFAULT 'no_wallet',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "claimed_at" TIMESTAMPTZ,
    "swept_to_treasury_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "unclaimed_funds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unclaimed_funds_source_agent_id_idx" ON "unclaimed_funds"("source_agent_id");

-- CreateIndex
CREATE INDEX "unclaimed_funds_recipient_type_idx" ON "unclaimed_funds"("recipient_type");

-- CreateIndex
CREATE INDEX "unclaimed_funds_expires_at_idx" ON "unclaimed_funds"("expires_at");

-- CreateIndex
CREATE INDEX "unclaimed_funds_claimed_at_idx" ON "unclaimed_funds"("claimed_at");

-- CreateIndex
CREATE INDEX "unclaimed_funds_swept_to_treasury_at_idx" ON "unclaimed_funds"("swept_to_treasury_at");

-- CreateIndex
CREATE UNIQUE INDEX "unclaimed_funds_clip_vote_id_recipient_type_key" ON "unclaimed_funds"("clip_vote_id", "recipient_type");

-- CreateIndex
CREATE INDEX "agents_deleted_at_idx" ON "agents"("deleted_at");

-- CreateIndex
CREATE INDEX "clip_variants_status_idx" ON "clip_variants"("status");

-- AddForeignKey
ALTER TABLE "unclaimed_funds" ADD CONSTRAINT "unclaimed_funds_source_agent_id_fkey" FOREIGN KEY ("source_agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unclaimed_funds" ADD CONSTRAINT "unclaimed_funds_clip_vote_id_fkey" FOREIGN KEY ("clip_vote_id") REFERENCES "clip_votes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
