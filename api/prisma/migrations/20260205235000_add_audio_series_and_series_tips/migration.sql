-- Audio limited miniseries + series-level tipping
-- Safe, additive migration (no destructive drops).

-- -----------------------------------------------------------------------------
-- LimitedSeries: medium + audio metadata
-- -----------------------------------------------------------------------------
ALTER TABLE "limited_series"
  ADD COLUMN IF NOT EXISTS "medium" VARCHAR(10) NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS "narration_voice_id" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "audio_pack" TEXT;

-- -----------------------------------------------------------------------------
-- Episode: audio script + allow null arc/shots for audio-only episodes
-- -----------------------------------------------------------------------------
ALTER TABLE "episodes"
  ADD COLUMN IF NOT EXISTS "audio_script_text" TEXT;

ALTER TABLE "episodes"
  ALTER COLUMN "arc_data" DROP NOT NULL,
  ALTER COLUMN "shots_data" DROP NOT NULL;

ALTER TABLE "episodes"
  ADD COLUMN IF NOT EXISTS "tts_retry_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tts_error_message" TEXT;

-- -----------------------------------------------------------------------------
-- SeriesTips: x402 payment record for tipping an entire series
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "series_tips" (
  "id" UUID NOT NULL,
  "series_id" UUID NOT NULL,
  "payer_address" VARCHAR(100) NOT NULL,
  "voter_key" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tip_amount_cents" INTEGER NOT NULL DEFAULT 0,
  "payment_tx_hash" VARCHAR(100),
  "payment_status" VARCHAR(20) NOT NULL DEFAULT 'none',
  CONSTRAINT "series_tips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "series_tips_series_id_idx" ON "series_tips" ("series_id");
CREATE INDEX IF NOT EXISTS "series_tips_voter_key_idx" ON "series_tips" ("voter_key");
CREATE INDEX IF NOT EXISTS "series_tips_payment_status_idx" ON "series_tips" ("payment_status");
CREATE UNIQUE INDEX IF NOT EXISTS "series_tips_series_id_voter_key_key" ON "series_tips" ("series_id", "voter_key");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'series_tips_series_id_fkey'
  ) THEN
    ALTER TABLE "series_tips"
      ADD CONSTRAINT "series_tips_series_id_fkey"
      FOREIGN KEY ("series_id") REFERENCES "limited_series"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Payouts: support series-level tip payouts
-- -----------------------------------------------------------------------------
ALTER TABLE "payouts"
  ADD COLUMN IF NOT EXISTS "series_tip_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "payouts_series_tip_id_recipient_type_key"
  ON "payouts" ("series_tip_id", "recipient_type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payouts_series_tip_id_fkey'
  ) THEN
    ALTER TABLE "payouts"
      ADD CONSTRAINT "payouts_series_tip_id_fkey"
      FOREIGN KEY ("series_tip_id") REFERENCES "series_tips"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Unclaimed funds: support series-level tip escrow
-- -----------------------------------------------------------------------------
ALTER TABLE "unclaimed_funds"
  ADD COLUMN IF NOT EXISTS "series_tip_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "unclaimed_funds_series_tip_id_recipient_type_key"
  ON "unclaimed_funds" ("series_tip_id", "recipient_type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unclaimed_funds_series_tip_id_fkey'
  ) THEN
    ALTER TABLE "unclaimed_funds"
      ADD CONSTRAINT "unclaimed_funds_series_tip_id_fkey"
      FOREIGN KEY ("series_tip_id") REFERENCES "series_tips"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Refunds: allow refunds for clip tips OR series tips
-- -----------------------------------------------------------------------------
ALTER TABLE "refunds"
  ALTER COLUMN "clip_vote_id" DROP NOT NULL;

ALTER TABLE "refunds"
  ADD COLUMN IF NOT EXISTS "series_tip_id" UUID;

CREATE INDEX IF NOT EXISTS "refunds_series_tip_id_idx" ON "refunds" ("series_tip_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'refunds_series_tip_id_fkey'
  ) THEN
    ALTER TABLE "refunds"
      ADD CONSTRAINT "refunds_series_tip_id_fkey"
      FOREIGN KEY ("series_tip_id") REFERENCES "series_tips"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
