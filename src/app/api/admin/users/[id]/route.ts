import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent } from "@/lib/request";
import { passwordSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const patchSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED", "DELETED"]).optional(),
  emailVerified: z.boolean().optional(),
  password: passwordSchema.optional()
});

export function GET(_request: NextRequest, { params }: Params) {
  return route(async () => {
    await requireAdmin();
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        projects: { take: 20, orderBy: { createdAt: "desc" } },
        claims: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: { project: { select: { id: true, name: true } }, cdk: { select: { id: true, status: true } } }
        }
      }
    });
    if (!user) throw new ApiError("用户不存在", 404, "USER_NOT_FOUND");
    return ok({ user });
  });
}

export function PATCH(request: NextRequest, { params }: Params) {
  return route(async () => {
    const actor = await requireAdmin();
    const body = patchSchema.parse(await request.json());
    const data = {
      role: body.role,
      status: body.status,
      emailVerified: body.emailVerified,
      passwordHash: body.password ? await hashPassword(body.password) : undefined
    };
    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, role: true, status: true, emailVerified: true }
    });
    await writeAuditLog({
      actor,
      action: "admin.user.update",
      targetType: "user",
      targetId: params.id,
      metadata: { fields: Object.keys(body) },
      ip: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    return ok({ user });
  });
}

export function DELETE(request: NextRequest, { params }: Params) {
  return route(async () => {
    const actor = await requireAdmin();
    if (actor.id === params.id) {
      throw new ApiError("不能删除当前登录账号", 409, "CANNOT_DELETE_SELF");
    }
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { status: "DELETED" },
      select: { id: true, email: true, status: true }
    });
    await writeAuditLog({
      actor,
      action: "admin.user.soft_delete",
      targetType: "user",
      targetId: params.id,
      ip: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    return ok({ user });
  });
}
