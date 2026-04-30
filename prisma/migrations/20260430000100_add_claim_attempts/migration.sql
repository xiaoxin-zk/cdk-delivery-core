CREATE TYPE "ClaimAttemptResult" AS ENUM ('WON', 'LOST');

CREATE TABLE "claim_attempts" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "cdk_id" TEXT,
  "user_id" TEXT,
  "email_or_identifier" TEXT,
  "result" "ClaimAttemptResult" NOT NULL,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "claim_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "claim_attempts_cdk_id_key" ON "claim_attempts"("cdk_id");
CREATE INDEX "claim_attempts_project_id_created_at_idx" ON "claim_attempts"("project_id", "created_at");
CREATE INDEX "claim_attempts_user_id_project_id_idx" ON "claim_attempts"("user_id", "project_id");
CREATE INDEX "claim_attempts_email_or_identifier_project_id_idx" ON "claim_attempts"("email_or_identifier", "project_id");

ALTER TABLE "claim_attempts"
  ADD CONSTRAINT "claim_attempts_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "claim_attempts"
  ADD CONSTRAINT "claim_attempts_cdk_id_fkey"
  FOREIGN KEY ("cdk_id") REFERENCES "cdks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "claim_attempts"
  ADD CONSTRAINT "claim_attempts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "claim_attempts" (
  "id",
  "project_id",
  "cdk_id",
  "user_id",
  "email_or_identifier",
  "result",
  "ip",
  "user_agent",
  "created_at"
)
SELECT
  "id",
  "project_id",
  "cdk_id",
  "user_id",
  "email_or_identifier",
  'WON'::"ClaimAttemptResult",
  "ip",
  "user_agent",
  "created_at"
FROM "claims";
