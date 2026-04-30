import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { canManageProject, requireUser } from "@/lib/auth";
import { getPagination, pageResult } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export function GET(request: NextRequest, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) throw new ApiError("项目不存在", 404, "PROJECT_NOT_FOUND");
    if (!canManageProject(user, project.ownerId)) throw new ApiError("无权查看该项目 CDK", 403, "PERMISSION_DENIED");

    const { page, pageSize, skip, take } = getPagination(request);
    const status = new URL(request.url).searchParams.get("status");
    const where = {
      projectId: params.id,
      status: status && ["AVAILABLE", "CLAIMED", "DISABLED"].includes(status) ? (status as never) : undefined
    };
    const [items, total] = await Promise.all([
      prisma.cdk.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          claimer: { select: { id: true, email: true } },
          claim: { select: { id: true, ip: true, userAgent: true, createdAt: true, emailOrIdentifier: true } }
        }
      }),
      prisma.cdk.count({ where })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}
