import { NextRequest, NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { canManageProject, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function GET(_request: NextRequest, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) throw new ApiError("项目不存在", 404, "PROJECT_NOT_FOUND");
    if (!canManageProject(user, project.ownerId)) throw new ApiError("无权导出该项目 CDK", 403, "PERMISSION_DENIED");

    const cdks = await prisma.cdk.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
      include: {
        claimer: { select: { email: true } },
        claim: { select: { ip: true, userAgent: true, createdAt: true, emailOrIdentifier: true } }
      }
    });
    const rows = [
      ["code", "status", "claimed_by", "claimed_at", "ip", "user_agent"].map(csvCell).join(","),
      ...cdks.map((cdk) =>
        [
          cdk.code,
          cdk.status,
          cdk.claimer?.email ?? cdk.claim?.emailOrIdentifier ?? "",
          cdk.claimedAt?.toISOString() ?? "",
          cdk.claim?.ip ?? "",
          cdk.claim?.userAgent ?? ""
        ]
          .map(csvCell)
          .join(",")
      )
    ];
    return new NextResponse(rows.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${project.name}-cdks.csv"`
      }
    });
  });
}
