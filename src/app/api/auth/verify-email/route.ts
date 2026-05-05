import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return route(async () => {
    const body = (await request.json()) as { token?: string };
    if (!body.token) throw new ApiError("缺少验证 token", 400, "TOKEN_REQUIRED");
    const emailToken = await prisma.emailToken.findFirst({
      where: {
        tokenHash: hashToken(body.token),
        type: "VERIFY_EMAIL",
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    if (!emailToken) throw new ApiError("验证链接无效或已过期", 400, "TOKEN_INVALID");

    await prisma.$transaction([
      prisma.user.update({
        where: { id: emailToken.userId },
        data: { emailVerified: true }
      }),
      prisma.emailToken.update({
        where: { id: emailToken.id },
        data: { usedAt: new Date() }
      })
    ]);

    return ok({ verified: true });
  });
}
