import { addHours } from "date-fns";
import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { getClientIp } from "@/lib/request";
import { buildActionEmail, sendMail } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRegistrationPolicy, isEmailDomainAllowed } from "@/lib/security";
import { getSetting } from "@/lib/settings";
import { verifyTurnstile } from "@/lib/turnstile";
import { hashToken, randomToken } from "@/lib/crypto";
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

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        emailVerified: !policy.emailVerification
      },
      select: { id: true, email: true, emailVerified: true }
    });

    if (policy.emailVerification) {
      const token = randomToken();
      await prisma.emailToken.create({
        data: {
          userId: user.id,
          type: "VERIFY_EMAIL",
          tokenHash: hashToken(token),
          expiresAt: addHours(new Date(), 24)
        }
      });
      const siteName = await getSetting("site.name");
      await sendMail({
        to: email,
        subject: `验证你的 ${siteName} 邮箱`,
        html: buildActionEmail({
          siteName,
          title: "邮箱验证",
          intro: "点击下方按钮完成邮箱验证。",
          buttonText: "验证邮箱",
          url: `${process.env.APP_URL ?? "http://localhost:3000"}/verify-email?token=${token}`,
          expiresIn: "24 小时"
        })
      });
    }

    return ok({ user }, 201);
  });
}
