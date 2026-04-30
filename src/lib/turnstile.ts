import { ApiError } from "@/lib/api";
import { asBoolean, getSettingsMap } from "@/lib/settings";

export type TurnstileContext =
  | "register"
  | "login"
  | "forgot-password"
  | "claim"
  | "create-project";

const CONTEXT_SETTING_KEYS: Record<TurnstileContext, string> = {
  register: "turnstile.register.enabled",
  login: "turnstile.login.enabled",
  "forgot-password": "turnstile.forgotPassword.enabled",
  claim: "turnstile.claim.enabled",
  "create-project": "turnstile.createProject.enabled"
};

export async function verifyTurnstile(context: TurnstileContext, token: string | undefined, ip: string) {
  const settings = await getSettingsMap([
    "turnstile.enabled",
    "turnstile.siteKey",
    "turnstile.secretKey",
    CONTEXT_SETTING_KEYS[context]
  ]);
  const enabled = asBoolean(settings.get("turnstile.enabled"));
  const contextEnabled = asBoolean(settings.get(CONTEXT_SETTING_KEYS[context]));
  if (!enabled || !contextEnabled) return;

  const siteKey = settings.get("turnstile.siteKey");
  const secret = settings.get("turnstile.secretKey");
  if (!siteKey || !secret) {
    throw new ApiError("已开启 Turnstile，但 Site Key 或 Secret Key 未配置完整。", 500, "TURNSTILE_NOT_CONFIGURED");
  }
  if (!token) throw new ApiError("请完成人机验证", 400, "TURNSTILE_REQUIRED");

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  const result = (await response.json()) as { success?: boolean };
  if (!result.success) throw new ApiError("人机验证失败，请重试", 400, "TURNSTILE_FAILED");
}
