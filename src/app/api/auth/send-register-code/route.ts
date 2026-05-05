import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { sendRegisterVerificationCode } from "@/lib/email-verification";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRegistrationPolicy, isEmailDomainAllowed } from "@/lib/security";
import { asBoolean, getSetting } from "@/lib/settings";
import { verifyTurnstile } from "@/lib/turnstile";
import { normalizeEmail, sendRegisterCodeSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return route(async () => {
    const ip = getClientIp(request);
    await enforceRateLimit(`send-register-code:${ip}`, 5, 60);
    const emailVerificationEnabled = asBoolean(await getSetting("email.verification.enabled"));
    if (!emailVerificationEnabled) {
      throw new ApiError("当前站点未开启邮箱验证", 400, "EMAIL_VERIFICATION_DISABLED");
    }

    const body = sendRegisterCodeSchema.parse(await request.json());
    await verifyTurnstile("register", body.turnstileToken, ip);
    const email = normalizeEmail(body.email);
    await enforceRateLimit(`send-register-code-email:${email}`, 3, 3600);

    const policy = await getRegistrationPolicy();
    if (!policy.enabled) throw new ApiError("管理员已关闭注册", 403, "REGISTRATION_DISABLED");
    if (!isEmailDomainAllowed(email, policy.allowedDomains)) {
      throw new ApiError("该邮箱后缀暂不允许注册", 403, "EMAIL_DOMAIN_BLOCKED");
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ApiError("该邮箱已被注册", 409, "EMAIL_ALREADY_REGISTERED");

    const passwordHash = await hashPassword(body.password);
    await sendRegisterVerificationCode({ email, passwordHash });
    return ok({ sent: true, email });
  });
}
