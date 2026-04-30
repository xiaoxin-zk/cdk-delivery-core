import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent } from "@/lib/request";
import { cleanText } from "@/lib/security";
import { coverImageUrlSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  content: z.string().trim().min(1).max(5000).optional(),
  instructions: z.string().trim().max(5000).optional(),
  coverImage: coverImageUrlSchema.optional().nullable(),
  status: z.enum(["DRAFT", "PUBLIC", "PAUSED", "ENDED", "DISABLED"]).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  claimMode: z.enum(["LOTTERY", "ONCE", "REPEAT"]).optional(),
  lotteryProbability: z.number().int().min(1).max(100).optional(),
  requireLogin: z.boolean().optional(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  reviewReason: z.string().max(1000).optional().nullable(),
  dailyLimit: z.number().nullable().optional(),
  totalLimit: z.number().nullable().optional(),
  perUserLimit: z.number().nullable().optional()
});

export function GET(_request: NextRequest, { params }: Params) {
  return route(async () => {
    await requireAdmin();
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, email: true } },
        _count: { select: { cdks: true, claims: true } },
        claims: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, email: true } }, cdk: { select: { id: true, status: true } } }
        }
      }
    });
    if (!project) throw new ApiError("项目不存在", 404, "PROJECT_NOT_FOUND");
    return ok({ project });
  });
}

export function PATCH(request: NextRequest, { params }: Params) {
  return route(async () => {
    const actor = await requireAdmin();
    const body = patchSchema.parse(await request.json());
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...body,
        name: body.name === undefined ? undefined : cleanText(body.name),
        description: body.description === undefined ? undefined : cleanText(body.description),
        content: body.content === undefined ? undefined : cleanText(body.content),
        instructions: body.instructions === undefined ? undefined : cleanText(body.instructions),
        coverImage: body.coverImage === undefined ? undefined : body.coverImage || null
      }
    });
    await writeAuditLog({
      actor,
      action: "admin.project.update",
      targetType: "project",
      targetId: params.id,
      metadata: { fields: Object.keys(body) },
      ip: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    return ok({ project });
  });
}

export function DELETE(request: NextRequest, { params }: Params) {
  return route(async () => {
    const actor = await requireAdmin();
    await prisma.project.delete({ where: { id: params.id } });
    await writeAuditLog({
      actor,
      action: "admin.project.delete",
      targetType: "project",
      targetId: params.id,
      ip: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    return ok({ deleted: true });
  });
}
