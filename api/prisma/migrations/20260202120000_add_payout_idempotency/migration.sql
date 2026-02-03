-- Add unique constraint for payout idempotency
-- This prevents duplicate payouts from network retries or race conditions
-- Each (clip_vote_id, recipient_type) combination can only have one payout

-- CreateIndex
CREATE UNIQUE INDEX "payouts_clip_vote_id_recipient_type_key" ON "payouts"("clip_vote_id", "recipient_type");
