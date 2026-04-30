CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'BOOLEAN', 'JSON_ARRAY', 'SECRET');

ALTER TABLE "claims"
  ADD COLUMN "claim_mode_snapshot" "ClaimMode";

UPDATE "claims" AS c
SET "claim_mode_snapshot" = p."claim_mode"
FROM "projects" AS p
WHERE c."project_id" = p."id"
  AND c."claim_mode_snapshot" IS NULL;

ALTER TABLE "claims"
  ALTER COLUMN "claim_mode_snapshot" SET DEFAULT 'ONCE',
  ALTER COLUMN "claim_mode_snapshot" SET NOT NULL;

ALTER TABLE "claim_attempts"
  ADD COLUMN "claim_mode_snapshot" "ClaimMode";

UPDATE "claim_attempts"
SET "claim_mode_snapshot" = 'LOTTERY'
WHERE "claim_mode_snapshot" IS NULL;

ALTER TABLE "claim_attempts"
  ALTER COLUMN "claim_mode_snapshot" SET DEFAULT 'LOTTERY',
  ALTER COLUMN "claim_mode_snapshot" SET NOT NULL;

ALTER TABLE "system_settings"
  ADD COLUMN "value_type" "SettingValueType" NOT NULL DEFAULT 'STRING';

UPDATE "system_settings"
SET "value_type" = CASE
  WHEN "encrypted" = true THEN 'SECRET'::"SettingValueType"
  WHEN "key" IN (
    'registration.enabled',
    'email.verification.enabled',
    'forgotPassword.enabled',
    'smtp.secure',
    'turnstile.enabled',
    'turnstile.register.enabled',
    'turnstile.login.enabled',
    'turnstile.forgotPassword.enabled',
    'turnstile.claim.enabled',
    'turnstile.createProject.enabled',
    'project.review.enabled',
    'project.review.userRequired',
    'sensitiveWords.enabled'
  ) THEN 'BOOLEAN'::"SettingValueType"
  WHEN "key" IN ('registration.allowedDomains') THEN 'JSON_ARRAY'::"SettingValueType"
  ELSE 'STRING'::"SettingValueType"
END;

CREATE INDEX "claims_project_id_user_id_claim_mode_snapshot_idx" ON "claims"("project_id", "user_id", "claim_mode_snapshot");
CREATE INDEX "claims_project_id_email_or_identifier_claim_mode_snapshot_idx" ON "claims"("project_id", "email_or_identifier", "claim_mode_snapshot");
CREATE INDEX "claim_attempts_project_id_user_id_claim_mode_snapshot_idx" ON "claim_attempts"("project_id", "user_id", "claim_mode_snapshot");
CREATE INDEX "claim_attempts_project_id_email_or_identifier_claim_mode_snapshot_idx" ON "claim_attempts"("project_id", "email_or_identifier", "claim_mode_snapshot");
CREATE INDEX "claim_attempts_project_id_claim_mode_snapshot_created_at_idx" ON "claim_attempts"("project_id", "claim_mode_snapshot", "created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
