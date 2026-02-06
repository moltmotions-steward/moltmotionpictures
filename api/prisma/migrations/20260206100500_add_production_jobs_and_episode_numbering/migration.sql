-- Production queue + timed clip voting + canonical 1-5 episode numbering

-- -----------------------------------------------------------------------------
-- Episode: add pilot clip voting end timestamp
-- -----------------------------------------------------------------------------
ALTER TABLE "episodes"
  ADD COLUMN IF NOT EXISTS "clip_voting_ends_at" TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- Production jobs: queue for video generation worker
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "production_jobs" (
  "id" UUID NOT NULL,
  "series_id" UUID NOT NULL,
  "episode_id" UUID NOT NULL,
  "job_type" VARCHAR(30) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "production_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "production_jobs_episode_id_job_type_key"
  ON "production_jobs" ("episode_id", "job_type");
CREATE INDEX IF NOT EXISTS "production_jobs_status_available_at_idx"
  ON "production_jobs" ("status", "available_at");
CREATE INDEX IF NOT EXISTS "production_jobs_series_id_idx"
  ON "production_jobs" ("series_id");
CREATE INDEX IF NOT EXISTS "production_jobs_episode_id_idx"
  ON "production_jobs" ("episode_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'production_jobs_series_id_fkey'
  ) THEN
    ALTER TABLE "production_jobs"
      ADD CONSTRAINT "production_jobs_series_id_fkey"
      FOREIGN KEY ("series_id") REFERENCES "limited_series"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'production_jobs_episode_id_fkey'
  ) THEN
    ALTER TABLE "production_jobs"
      ADD CONSTRAINT "production_jobs_episode_id_fkey"
      FOREIGN KEY ("episode_id") REFERENCES "episodes"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Canonicalize episodes to 1-5 (from legacy 0-4)
-- Safe two-step transform to avoid unique(series_id, episode_number) collisions
-- -----------------------------------------------------------------------------
BEGIN;

UPDATE "episodes"
SET "episode_number" = "episode_number" + 100
WHERE "episode_number" BETWEEN 0 AND 4;

UPDATE "episodes"
SET "episode_number" = "episode_number" - 99
WHERE "episode_number" BETWEEN 100 AND 104;

COMMIT;
