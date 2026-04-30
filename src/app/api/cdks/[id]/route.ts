import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, route } from "@/lib/api";
import { canManageProject, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const patchSchema = z.object({
  status: z.enum(["AVAILABLE", "DISABLED"]).optional()
});

export function PATCH(request: NextRequest, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const cdk = await prisma.cdk.findUnique({
      where: { id: params.id },
      include: { project: true }
    });
    if (!cdk) throw new ApiError("CDK 不存在", 404, "CDK_NOT_FOUND");
    if (!canManageProject(user, cdk.project.ownerId)) throw new ApiError("无权操作该 CDK", 403, "PERMISSION_DENIED");
    if (cdk.status === "CLAIMED") throw new ApiError("已领取的 CDK 不能修改状态", 409, "CDK_CLAIMED");

    const body = patchSchema.parse(await request.json());
    const updated = await prisma.cdk.update({
      where: { id: params.id },
      data: {
        status: body.status,
        disabledAt: body.status === "DISABLED" ? new Date() : null
      }
    });
    return ok({ cdk: updated });
  });
}

export function DELETE(_request: NextRequest, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const cdk = await prisma.cdk.findUnique({
      where: { id: params.id },
      include: { project: true }
    });
    if (!cdk) throw new ApiError("CDK 不存在", 404, "CDK_NOT_FOUND");
    if (!canManageProject(user, cdk.project.ownerId)) throw new ApiError("无权删除该 CDK", 403, "PERMISSION_DENIED");
    if (cdk.status !== "AVAILABLE") throw new ApiError("只能删除未领取 CDK", 409, "CDK_NOT_AVAILABLE");
    await prisma.cdk.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  });
}
