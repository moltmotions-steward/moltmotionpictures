/*
  Warnings:

  - You are about to drop the column `agent_id` on the `payouts` table. All the data in the column will be lost.
  - Added the required column `recipient_type` to the `payouts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source_agent_id` to the `payouts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `split_percent` to the `payouts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `wallet_address` to the `payouts` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "payouts_agent_id_idx";

-- AlterTable
ALTER TABLE "payouts" DROP COLUMN "agent_id",
ADD COLUMN     "clip_vote_id" UUID,
ADD COLUMN     "recipient_agent_id" UUID,
ADD COLUMN     "recipient_type" VARCHAR(20) NOT NULL,
ADD COLUMN     "source_agent_id" UUID NOT NULL,
ADD COLUMN     "split_percent" INTEGER NOT NULL,
ADD COLUMN     "wallet_address" VARCHAR(100) NOT NULL;

-- CreateIndex
CREATE INDEX "payouts_source_agent_id_idx" ON "payouts"("source_agent_id");

-- CreateIndex
CREATE INDEX "payouts_recipient_agent_id_idx" ON "payouts"("recipient_agent_id");

-- CreateIndex
CREATE INDEX "payouts_recipient_type_idx" ON "payouts"("recipient_type");
