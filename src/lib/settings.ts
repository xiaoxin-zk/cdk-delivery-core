import { prisma } from "@/lib/prisma";
import { decryptText, encryptText } from "@/lib/crypto";

export const DEFAULT_SETTINGS: Record<string, string> = {
  "site.name": "CDK Delivery Core",
  "site.logoUrl": "",
  "site.footerText": "仅用于合法 CDK、授权码、兑换码分发场景。",
  "site.termsUrl": "",
  "site.privacyUrl": "",
  "registration.enabled": "true",
  "registration.allowedDomains": "[]",
  "email.verification.enabled": "false",
  "forgotPassword.enabled": "true",
  "smtp.host": process.env.SMTP_HOST ?? "",
  "smtp.port": process.env.SMTP_PORT ?? "587",
  "smtp.username": process.env.SMTP_USERNAME ?? "",
  "smtp.password": process.env.SMTP_PASSWORD ?? "",
  "smtp.fromName": process.env.SMTP_FROM_NAME ?? "CDK Delivery Core",
  "smtp.fromEmail": process.env.SMTP_FROM_EMAIL ?? "no-reply@example.com",
  "smtp.secure": process.env.SMTP_SECURE ?? "false",
  "turnstile.enabled": "false",
  "turnstile.siteKey": process.env.TURNSTILE_SITE_KEY ?? "",
  "turnstile.secretKey": process.env.TURNSTILE_SECRET_KEY ?? "",
  "turnstile.register.enabled": "true",
  "turnstile.login.enabled": "true",
  "turnstile.forgotPassword.enabled": "true",
  "turnstile.claim.enabled": "true",
  "turnstile.createProject.enabled": "true",
  "project.review.enabled": "false",
  "project.review.userRequired": "false",
  "sensitiveWords.enabled": "true",
  "sensitiveWords.mode": "review",
  "claim.rateLimit.perMinute": "10"
};

export const SENSITIVE_SETTING_KEYS = new Set(["smtp.password", "turnstile.secretKey"]);
export const BOOLEAN_SETTING_KEYS = new Set([
  "registration.enabled",
  "email.verification.enabled",
  "forgotPassword.enabled",
  "smtp.secure",
  "turnstile.enabled",
  "turnstile.register.enabled",
  "turnstile.login.enabled",
  "turnstile.forgotPassword.enabled",
  "turnstile.claim.enabled",
  "turnstile.createProject.enabled",
  "project.review.enabled",
  "project.review.userRequired",
  "sensitiveWords.enabled"
]);
export const JSON_ARRAY_SETTING_KEYS = new Set(["registration.allowedDomains"]);

export function getSettingValueType(key: string) {
  if (SENSITIVE_SETTING_KEYS.has(key)) return "SECRET";
  if (BOOLEAN_SETTING_KEYS.has(key)) return "BOOLEAN";
  if (JSON_ARRAY_SETTING_KEYS.has(key)) return "JSON_ARRAY";
  return "STRING";
}
export const SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));
export const SENSITIVE_CONFIGURED_LABEL = "已配置";

export async function getSettingsMap(keys?: string[]) {
  const rows = await prisma.systemSetting.findMany({
    where: keys ? { key: { in: keys } } : undefined
  });
  const map = new Map<string, string>();

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!keys || keys.includes(key)) map.set(key, value);
  }

  for (const row of rows) {
    if (row.encrypted) {
      try {
        map.set(row.key, decryptText(row.value));
      } catch {
        map.set(row.key, row.value);
      }
    } else {
      map.set(row.key, row.value);
    }
  }

  return map;
}

export async function getSetting(key: string) {
  const map = await getSettingsMap([key]);
  return map.get(key) ?? "";
}

export function asBoolean(value: string | undefined) {
  return value === "true" || value === "1" || value === "yes";
}

export function asList(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fall through to delimiter parsing for legacy values.
    }
  }
  return raw
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function saveSettings(updates: Record<string, string>) {
  for (const [key, rawValue] of Object.entries(updates)) {
    if (!SETTING_KEYS.has(key)) continue;
    const encrypted = SENSITIVE_SETTING_KEYS.has(key);
    if (encrypted && (!rawValue || rawValue === SENSITIVE_CONFIGURED_LABEL)) continue;
    const value = encrypted ? encryptText(rawValue) : rawValue;
    const valueType = getSettingValueType(key);
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value, encrypted, valueType },
      create: { key, value, encrypted, valueType }
    });
  }
}

export async function getAdminSettings() {
  const map = await getSettingsMap();
  return Object.fromEntries(
    [...map.entries()].map(([key, value]) => [
      key,
      SENSITIVE_SETTING_KEYS.has(key) && value ? SENSITIVE_CONFIGURED_LABEL : value
    ])
  );
}

export async function getPublicSettings() {
  const map = await getSettingsMap([
    "site.name",
    "site.logoUrl",
    "site.footerText",
    "site.termsUrl",
    "site.privacyUrl",
    "registration.enabled",
    "forgotPassword.enabled",
    "turnstile.enabled",
    "turnstile.siteKey",
    "turnstile.register.enabled",
    "turnstile.login.enabled",
    "turnstile.forgotPassword.enabled",
    "turnstile.claim.enabled",
    "turnstile.createProject.enabled"
  ]);
  return {
    siteName: map.get("site.name") ?? DEFAULT_SETTINGS["site.name"],
    logoUrl: map.get("site.logoUrl") ?? "",
    footerText: map.get("site.footerText") ?? "",
    termsUrl: map.get("site.termsUrl") ?? "",
    privacyUrl: map.get("site.privacyUrl") ?? "",
    registrationEnabled: asBoolean(map.get("registration.enabled")),
    forgotPasswordEnabled: asBoolean(map.get("forgotPassword.enabled")),
    turnstile: {
      enabled: asBoolean(map.get("turnstile.enabled")),
      siteKey: map.get("turnstile.siteKey") ?? "",
      contexts: {
        register: asBoolean(map.get("turnstile.register.enabled")),
        login: asBoolean(map.get("turnstile.login.enabled")),
        forgotPassword: asBoolean(map.get("turnstile.forgotPassword.enabled")),
        claim: asBoolean(map.get("turnstile.claim.enabled")),
        createProject: asBoolean(map.get("turnstile.createProject.enabled"))
      }
    }
  };
}
