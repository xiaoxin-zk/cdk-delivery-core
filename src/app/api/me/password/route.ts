import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { passwordSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema
});

export function PATCH(request: NextRequest) {
  return route(async () => {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const record = await prisma.user.findUnique({ where: { id: user.id } });
    if (!record || !(await verifyPassword(body.currentPassword, record.passwordHash))) {
      throw new ApiError("当前密码不正确", 400, "PASSWORD_INVALID");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) }
    });
    return ok({ updated: true });
  });
}
