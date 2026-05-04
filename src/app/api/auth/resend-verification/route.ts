import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { resendPendingVerificationEmail } from "@/lib/email-verification";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { enforceRateLimit } from "@/lib/rate-limit";
import { asBoolean, getSetting } from "@/lib/settings";
import { verifyTurnstile } from "@/lib/turnstile";
import { loginSchema, normalizeEmail } from "@/lib/validators";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return route(async () => {
    const ip = getClientIp(request);
    await enforceRateLimit(`resend-verification:${ip}`, 5, 60);
    const emailVerificationEnabled = asBoolean(await getSetting("email.verification.enabled"));
    if (!emailVerificationEnabled) {
      throw new ApiError("当前站点未开启邮箱验证", 400, "EMAIL_VERIFICATION_DISABLED");
    }

    const body = loginSchema.parse(await request.json());
    await verifyTurnstile("login", body.turnstileToken, ip);
    const email = normalizeEmail(body.email);
    await enforceRateLimit(`resend-verification-email:${email}`, 3, 3600);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      if (!(await verifyPassword(body.password, user.passwordHash))) {
        throw new ApiError("邮箱或密码错误", 401, "INVALID_CREDENTIALS");
      }
      if (user.status !== "ACTIVE") throw new ApiError("账号不可用，请联系管理员", 403, "USER_DISABLED");
      if (user.emailVerified) return ok({ sent: false, verified: true });
    }

    const pending = await prisma.pendingEmailVerification.findUnique({ where: { email } });
    if (!pending || !(await verifyPassword(body.password, pending.passwordHash))) {
      throw new ApiError("邮箱或密码错误", 401, "INVALID_CREDENTIALS");
    }

    await resendPendingVerificationEmail(email);
    return ok({ sent: true, verified: false });
  });
}
