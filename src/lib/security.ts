import { prisma } from "@/lib/prisma";
import { asBoolean, asList, getSettingsMap } from "@/lib/settings";

export function isEmailDomainAllowed(email: string, allowedDomains: string[]) {
  if (allowedDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  return Boolean(domain && allowedDomains.map((item) => item.toLowerCase()).includes(domain));
}

export function cleanText(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

export async function inspectSensitiveText(text: string) {
  const result = await inspectSensitiveFields([{ label: "内容", text }]);
  return {
    matched: result.matched,
    mode: result.mode
  };
}

export async function inspectSensitiveFields(fields: Array<{ label: string; text: string }>) {
  const settings = await getSettingsMap(["sensitiveWords.enabled", "sensitiveWords.mode"]);
  if (!asBoolean(settings.get("sensitiveWords.enabled"))) {
    return { matched: [] as string[], matchedFields: [] as Array<{ label: string; words: string[] }>, mode: "off" };
  }

  const words = await prisma.sensitiveWord.findMany({
    where: { enabled: true },
    select: { word: true }
  });
  const normalizedWords = words.map((item) => item.word.trim()).filter(Boolean);
  const matchedFields = fields
    .map((field) => {
      const lower = field.text.toLowerCase();
      const fieldWords = normalizedWords.filter((word) => lower.includes(word.toLowerCase()));
      return { label: field.label, words: [...new Set(fieldWords)] };
    })
    .filter((field) => field.words.length > 0);
  const matched = [...new Set(matchedFields.flatMap((field) => field.words))];

  return {
    matched,
    matchedFields,
    mode: settings.get("sensitiveWords.mode") ?? "review"
  };
}

export async function getRegistrationPolicy() {
  const settings = await getSettingsMap([
    "registration.enabled",
    "registration.allowedDomains",
    "email.verification.enabled"
  ]);
  return {
    enabled: asBoolean(settings.get("registration.enabled")),
    allowedDomains: asList(settings.get("registration.allowedDomains")),
    emailVerification: asBoolean(settings.get("email.verification.enabled"))
  };
}
