import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { canManageProject, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cdkImportSchema, splitCdkLines } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export function POST(request: NextRequest, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) throw new ApiError("项目不存在", 404, "PROJECT_NOT_FOUND");
    if (!canManageProject(user, project.ownerId)) throw new ApiError("无权管理该项目 CDK", 403, "PERMISSION_DENIED");

    const body = cdkImportSchema.parse(await request.json());
    const lines = splitCdkLines(body.text);
    if (lines.length === 0) throw new ApiError("没有可导入的 CDK", 400, "NO_CDK");
    if (lines.length > 10000) throw new ApiError("单次最多导入 10000 条 CDK", 422, "TOO_MANY_CDKS");
    const tooLong = lines.find((line) => line.length > 1000);
    if (tooLong) throw new ApiError("单条 CDK 不能超过 1000 个字符", 422, "CDK_TOO_LONG");

    await prisma.cdk.createMany({
      data: lines.map((code) => ({
        projectId: params.id,
        code
      }))
    });

    return ok({ imported: lines.length }, 201);
  });
}
