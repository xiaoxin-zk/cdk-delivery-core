CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DELETED');
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PUBLIC', 'PAUSED', 'ENDED', 'DISABLED');
CREATE TYPE "ProjectVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "ClaimMode" AS ENUM ('ONCE', 'REPEAT');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "CdkStatus" AS ENUM ('AVAILABLE', 'CLAIMED', 'DISABLED');
CREATE TYPE "EmailTokenType" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

CREATE TABLE "users" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "owner_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "instructions" TEXT NOT NULL,
  "cover_image" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "ProjectVisibility" NOT NULL DEFAULT 'PUBLIC',
  "claim_mode" "ClaimMode" NOT NULL DEFAULT 'ONCE',
  "require_login" BOOLEAN NOT NULL DEFAULT true,
  "start_at" TIMESTAMP(3),
  "end_at" TIMESTAMP(3),
  "daily_limit" INTEGER,
  "total_limit" INTEGER,
  "per_user_limit" INTEGER,
  "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
  "review_reason" TEXT,
  "illegal_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cdks" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "project_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "CdkStatus" NOT NULL DEFAULT 'AVAILABLE',
  "claimed_by" TEXT,
  "claimed_at" TIMESTAMP(3),
  "disabled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cdks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "claims" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "project_id" TEXT NOT NULL,
  "cdk_id" TEXT NOT NULL,
  "user_id" TEXT,
  "email_or_identifier" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "encrypted" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "email_tokens" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "type" "EmailTokenType" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "actor_id" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT,
  "metadata" JSONB,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sensitive_words" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "word" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sensitive_words_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");
CREATE INDEX "projects_status_visibility_review_status_idx" ON "projects"("status", "visibility", "review_status");
CREATE INDEX "cdks_project_id_status_idx" ON "cdks"("project_id", "status");
CREATE INDEX "cdks_claimed_by_idx" ON "cdks"("claimed_by");
CREATE UNIQUE INDEX "claims_cdk_id_key" ON "claims"("cdk_id");
CREATE INDEX "claims_project_id_created_at_idx" ON "claims"("project_id", "created_at");
CREATE INDEX "claims_user_id_project_id_idx" ON "claims"("user_id", "project_id");
CREATE INDEX "email_tokens_user_id_type_idx" ON "email_tokens"("user_id", "type");
CREATE INDEX "email_tokens_token_hash_idx" ON "email_tokens"("token_hash");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");
CREATE UNIQUE INDEX "sensitive_words_word_key" ON "sensitive_words"("word");

ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cdks" ADD CONSTRAINT "cdks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cdks" ADD CONSTRAINT "cdks_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "claims" ADD CONSTRAINT "claims_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claims" ADD CONSTRAINT "claims_cdk_id_fkey" FOREIGN KEY ("cdk_id") REFERENCES "cdks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claims" ADD CONSTRAINT "claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
