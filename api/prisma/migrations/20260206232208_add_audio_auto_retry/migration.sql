-- Add auto-retry fields for audio TTS generation
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS tts_auto_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tts_last_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tts_auto_retry_enabled BOOLEAN NOT NULL DEFAULT true;

-- Create index for efficient auto-retry queries
CREATE INDEX IF NOT EXISTS idx_episodes_auto_retry
  ON episodes(status, tts_last_failed_at, tts_auto_retry_enabled)
  WHERE status = 'failed';
