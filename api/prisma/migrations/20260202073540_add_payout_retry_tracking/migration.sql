/*
  Warnings:

  - Added the required column `updated_at` to the `payouts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payouts" ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL;
