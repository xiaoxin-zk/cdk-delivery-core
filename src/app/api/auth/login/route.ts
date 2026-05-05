import { NextRequest, NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { createSessionToken, setAuthCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { enforceRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { loginSchema, normalizeEmail } from "@/lib/validators";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return route(async () => {
    const ip = getClientIp(request);
    await enforceRateLimit(`login:${ip}`, 10, 60);
    const body = loginSchema.parse(await request.json());
    await verifyTurnstile("login", body.turnstileToken, ip);

    const email = normalizeEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      const pending = await prisma.pendingEmailVerification.findUnique({ where: { email } });
      if (pending && (await verifyPassword(body.password, pending.passwordHash))) {
        throw new ApiError("请先输入邮箱验证码完成注册", 403, "EMAIL_NOT_VERIFIED");
      }
      throw new ApiError("邮箱或密码错误", 401, "INVALID_CREDENTIALS");
    }
    if (user.status !== "ACTIVE") throw new ApiError("账号不可用，请联系管理员", 403, "USER_DISABLED");
    if (!user.emailVerified) throw new ApiError("请先完成邮箱验证", 403, "EMAIL_NOT_VERIFIED");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified
    };
    const response = NextResponse.json({ ok: true, data: { user: authUser } });
    setAuthCookie(response, createSessionToken(authUser, Boolean(body.remember)), Boolean(body.remember));
    return response;
  });
}
