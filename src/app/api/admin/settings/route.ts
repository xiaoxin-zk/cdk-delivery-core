import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request";
import { asList, getAdminSettings, saveSettings, SENSITIVE_CONFIGURED_LABEL, SENSITIVE_SETTING_KEYS, SETTING_KEYS } from "@/lib/settings";
import { normalizeDomainSuffix } from "@/lib/validators";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
});

export function GET() {
  return route(async () => {
    await requireAdmin();
    return ok({ settings: await getAdminSettings() });
  });
}

export function PATCH(request: NextRequest) {
  return route(async () => {
    const actor = await requireAdmin();
    const body = settingsSchema.parse(await request.json());
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(body.settings)) {
      if (!SETTING_KEYS.has(key)) {
        throw new ApiError("未知系统设置项", 422, "UNKNOWN_SETTING_KEY");
      }
      const normalizedValue = value === null ? "" : String(value);
      if (SENSITIVE_SETTING_KEYS.has(key) && (!normalizedValue || normalizedValue === SENSITIVE_CONFIGURED_LABEL)) {
        continue;
      }
      if (key === "registration.allowedDomains") {
        const domains = asList(normalizedValue);
        const normalizedDomains = domains.map((domain) => normalizeDomainSuffix(domain));
        const invalid = normalizedDomains.find((result) => !result.success);
        if (invalid && !invalid.success) {
          throw new ApiError(invalid.error.issues[0]?.message ?? "邮箱后缀格式不正确", 422, "INVALID_EMAIL_DOMAIN");
        }
        updates[key] = JSON.stringify([...new Set(normalizedDomains.map((result) => result.success ? result.data : ""))].filter(Boolean));
      } else if (key === "sensitiveWords.mode") {
        if (!["review", "block"].includes(normalizedValue)) {
          throw new ApiError("敏感词处理方式不正确", 422, "INVALID_SENSITIVE_WORD_MODE");
        }
        updates[key] = normalizedValue;
      } else {
        updates[key] = normalizedValue;
      }
    }
    await saveSettings(updates);
    await writeAuditLog({
      actor,
      action: "admin.settings.update",
      targetType: "system_settings",
      metadata: { keys: Object.keys(updates) },
      ip: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    return ok({ settings: await getAdminSettings() });
  });
}
