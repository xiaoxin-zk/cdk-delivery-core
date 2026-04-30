import { addMinutes } from "date-fns";
import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { hashToken, randomToken } from "@/lib/crypto";
import { buildActionEmail, sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { enforceRateLimit } from "@/lib/rate-limit";
import { asBoolean, getSetting } from "@/lib/settings";
import { verifyTurnstile } from "@/lib/turnstile";
import { forgotPasswordSchema, normalizeEmail } from "@/lib/validators";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return route(async () => {
    const ip = getClientIp(request);
    await enforceRateLimit(`forgot:${ip}`, 5, 60);
    const enabled = asBoolean(await getSetting("forgotPassword.enabled"));
    if (!enabled) throw new ApiError("管理员已关闭找回密码功能", 403, "FORGOT_PASSWORD_DISABLED");

    const body = forgotPasswordSchema.parse(await request.json());
    await verifyTurnstile("forgot-password", body.turnstileToken, ip);
    const email = normalizeEmail(body.email);
    await enforceRateLimit(`forgot-email:${email}`, 3, 3600);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.status === "ACTIVE") {
      const token = randomToken();
      await prisma.emailToken.create({
        data: {
          userId: user.id,
          type: "RESET_PASSWORD",
          tokenHash: hashToken(token),
          expiresAt: addMinutes(new Date(), 30)
        }
      });
      const siteName = await getSetting("site.name");
      await sendMail({
        to: email,
        subject: `重置你的 ${siteName} 密码`,
        html: buildActionEmail({
          siteName,
          title: "重置密码",
          intro: "点击下方按钮设置新密码。",
          buttonText: "重置密码",
          url: `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`,
          expiresIn: "30 分钟"
        })
      });
    }

    return ok({ sent: true });
  });
}
