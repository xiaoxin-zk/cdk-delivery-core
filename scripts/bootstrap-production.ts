import { spawn } from "node:child_process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SettingDefault = { key: string; value: string; encrypted?: boolean };

const defaults: SettingDefault[] = [
  { key: "site.name", value: "CDK Delivery Core" },
  { key: "site.logoUrl", value: "" },
  { key: "site.footerText", value: "Only for lawful CDK, license key, and redemption code distribution." },
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
  { key: "smtp.fromEmail", value: process.env.SMTP_FROM_EMAIL ?? "" },
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

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function isExampleValue(value: string) {
  return value.startsWith("replace-with-") || value.startsWith("change-this-") || value === "ChangeMe123!" || value === "cdk_password";
}

function requireProductionSecret(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in production.`);
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters in production.`);
  if (isExampleValue(value)) {
    throw new Error(`${name} still contains an example or weak value. Replace it before starting production.`);
  }
}

function validateEnvironment() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (databaseUrl.includes("change-this-") || databaseUrl.includes("cdk_password")) {
    throw new Error("DATABASE_URL still contains an example database password. Replace it before starting production.");
  }
  requireProductionSecret("JWT_SECRET");
  requireProductionSecret("APP_SECRET");

  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (adminPassword && (isExampleValue(adminPassword) || adminPassword.length < 12)) {
    throw new Error("ADMIN_PASSWORD must be changed and at least 12 characters when ADMIN_EMAIL is set.");
  }

  const postgresPassword = process.env.POSTGRES_PASSWORD?.trim();
  if (postgresPassword && (isExampleValue(postgresPassword) || postgresPassword.length < 16)) {
    throw new Error("POSTGRES_PASSWORD must be changed and at least 16 characters for Docker deployments.");
  }
}

async function initializeSystemSettings() {
  for (const setting of defaults) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        encrypted: setting.encrypted ?? false
      }
    });
  }
}

async function initializeAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn("ADMIN_EMAIL or ADMIN_PASSWORD is missing. Admin bootstrap skipped.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    const passwordMatches = await bcrypt.compare(adminPassword, existing.passwordHash);
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        role: "ADMIN",
        status: "ACTIVE",
        emailVerified: true,
        ...(passwordMatches ? {} : { passwordHash: await bcrypt.hash(adminPassword, 12) })
      }
    });
    console.log(passwordMatches ? `Admin account ensured: ${adminEmail}` : `Admin account ensured (password synced from env): ${adminEmail}`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true
    }
  });
  console.log(`Admin account created: ${adminEmail}`);
}

async function main() {
  validateEnvironment();
  console.log("Applying database migrations...");
  await run("npx", ["prisma", "migrate", "deploy"]);
  console.log("Initializing system settings and admin account...");
  await initializeSystemSettings();
  await initializeAdmin();
  console.log("Production bootstrap complete. No demo data was created.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
