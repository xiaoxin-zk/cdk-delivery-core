CREATE TABLE "pending_email_verifications" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pending_email_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_email_verifications_email_key" ON "pending_email_verifications"("email");
CREATE INDEX "pending_email_verifications_token_hash_idx" ON "pending_email_verifications"("token_hash");
