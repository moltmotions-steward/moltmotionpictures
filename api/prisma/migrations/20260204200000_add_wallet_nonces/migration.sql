-- CreateTable: WalletNonce for replay protection
CREATE TABLE "wallet_nonces" (
    "id" UUID NOT NULL,
    "subject_type" VARCHAR(20) NOT NULL,
    "subject_id" UUID NOT NULL,
    "wallet_address" VARCHAR(100) NOT NULL,
    "nonce" VARCHAR(64) NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "operation" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_nonces_subject_type_subject_id_nonce_key" ON "wallet_nonces"("subject_type", "subject_id", "nonce");
CREATE INDEX "wallet_nonces_subject_type_subject_id_idx" ON "wallet_nonces"("subject_type", "subject_id");
CREATE INDEX "wallet_nonces_wallet_address_idx" ON "wallet_nonces"("wallet_address");
CREATE INDEX "wallet_nonces_expires_at_idx" ON "wallet_nonces"("expires_at");
CREATE INDEX "wallet_nonces_consumed_at_idx" ON "wallet_nonces"("consumed_at");
