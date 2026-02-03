-- AlterTable
ALTER TABLE "clip_votes" ADD COLUMN     "voter_key" VARCHAR(160);

-- CreateIndex
CREATE INDEX "clip_votes_voter_key_idx" ON "clip_votes"("voter_key");

-- CreateIndex
CREATE UNIQUE INDEX "clip_votes_clip_variant_id_voter_key_key" ON "clip_votes"("clip_variant_id", "voter_key");
