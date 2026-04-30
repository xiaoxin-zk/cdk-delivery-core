import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { hashToken } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { resetPasswordSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return route(async () => {
    const ip = getClientIp(request);
    await enforceRateLimit(`reset-password:${ip}`, 10, 60);
    const body = resetPasswordSchema.parse(await request.json());
    const tokenHash = hashToken(body.token);
    const token = await prisma.emailToken.findFirst({
      where: {
        tokenHash,
        type: "RESET_PASSWORD",
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    if (!token) throw new ApiError("重置链接无效或已过期", 400, "TOKEN_INVALID");

    await prisma.$transaction([
      prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash: await hashPassword(body.password) }
      }),
      prisma.emailToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() }
      }),
      prisma.emailToken.updateMany({
        where: {
          userId: token.userId,
          type: "RESET_PASSWORD",
          usedAt: null
        },
        data: { usedAt: new Date() }
      })
    ]);

    return ok({ reset: true });
  });
}
