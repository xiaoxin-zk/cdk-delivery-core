import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { getClientIp } from "@/lib/request";
import { createPendingEmailVerification } from "@/lib/email-verification";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRegistrationPolicy, isEmailDomainAllowed } from "@/lib/security";
import { verifyTurnstile } from "@/lib/turnstile";
import { normalizeEmail, registerSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return route(async () => {
    const ip = getClientIp(request);
    await enforceRateLimit(`register:${ip}`, 5, 60);
    const body = registerSchema.parse(await request.json());
    await verifyTurnstile("register", body.turnstileToken, ip);

    const email = normalizeEmail(body.email);
    const policy = await getRegistrationPolicy();
    if (!policy.enabled) throw new ApiError("管理员已关闭注册", 403, "REGISTRATION_DISABLED");
    if (!isEmailDomainAllowed(email, policy.allowedDomains)) {
      throw new ApiError("该邮箱后缀暂不允许注册", 403, "EMAIL_DOMAIN_BLOCKED");
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ApiError("该邮箱已被注册", 409, "EMAIL_ALREADY_REGISTERED");

    const passwordHash = await hashPassword(body.password);
    if (policy.emailVerification) {
      await createPendingEmailVerification({ email, passwordHash });
      return ok({ pendingVerification: true, email }, 202);
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        emailVerified: true
      },
      select: { id: true, email: true, emailVerified: true }
    });

    return ok({ user }, 201);
  });
}
