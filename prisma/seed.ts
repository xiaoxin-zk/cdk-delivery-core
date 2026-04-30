import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { getSettingValueType } from "../src/lib/settings";

const prisma = new PrismaClient();

const defaults: Array<{ key: string; value: string; encrypted?: boolean }> = [
  { key: "site.name", value: "CDK Delivery Core" },
  { key: "site.logoUrl", value: "" },
  { key: "site.footerText", value: "仅用于合法 CDK、授权码、兑换码分发场景。" },
  { key: "site.termsUrl", value: "" },
  { key: "site.privacyUrl", value: "" },
  { key: "registration.enabled", value: "true" },
  { key: "registration.allowedDomains", value: "[]" },
  { key: "email.verification.enabled", value: "false" },
  { key: "forgotPassword.enabled", value: "true" },
  { key: "smtp.host", value: process.env.SMTP_HOST ?? "" },
  { key: "smtp.port", value: process.env.SMTP_PORT ?? "587" },
  { key: "smtp.username", value: process.env.SMTP_USERNAME ?? "" },
  { key: "smtp.password", value: process.env.SMTP_PASSWORD ?? "", encrypted: true },
  { key: "smtp.fromName", value: process.env.SMTP_FROM_NAME ?? "CDK Delivery Core" },
  { key: "smtp.fromEmail", value: process.env.SMTP_FROM_EMAIL ?? "no-reply@example.com" },
  { key: "smtp.secure", value: process.env.SMTP_SECURE ?? "false" },
  { key: "turnstile.enabled", value: "false" },
  { key: "turnstile.siteKey", value: process.env.TURNSTILE_SITE_KEY ?? "" },
  { key: "turnstile.secretKey", value: process.env.TURNSTILE_SECRET_KEY ?? "", encrypted: true },
  { key: "turnstile.register.enabled", value: "true" },
  { key: "turnstile.login.enabled", value: "true" },
  { key: "turnstile.forgotPassword.enabled", value: "true" },
  { key: "turnstile.claim.enabled", value: "true" },
  { key: "turnstile.createProject.enabled", value: "true" },
  { key: "project.review.enabled", value: "false" },
  { key: "project.review.userRequired", value: "false" },
  { key: "sensitiveWords.enabled", value: "true" },
  { key: "sensitiveWords.mode", value: "review" },
  { key: "claim.rateLimit.perMinute", value: "10" }
];

async function main() {
  for (const setting of defaults) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        valueType: getSettingValueType(setting.key),
        encrypted: setting.encrypted ?? false
      }
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.warn("ADMIN_EMAIL or ADMIN_PASSWORD is missing. Admin bootstrap skipped.");
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true
    },
    create: {
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true
    }
  });

  console.log(`Admin ready: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
