import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/api";
import { canManageProject, getCurrentUser, requireUser } from "@/lib/auth";
import { projectReviewFields, reviewProjectSubmission } from "@/lib/project-review";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/security";
import { projectUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export function GET(_request: NextRequest, { params }: Params) {
  return route(async () => {
    const user = await getCurrentUser();
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, email: true } },
        _count: { select: { claims: true, cdks: true } }
      }
    });
    if (!project) throw new ApiError("项目不存在", 404, "PROJECT_NOT_FOUND");
    const manageable = user ? canManageProject(user, project.ownerId) : false;
    if ((project.visibility !== "PUBLIC" || project.reviewStatus !== "APPROVED") && !manageable) {
      throw new ApiError("该项目暂不可访问", 403, "PROJECT_UNAVAILABLE");
    }

    const availableCount = await prisma.cdk.count({
      where: { projectId: project.id, status: "AVAILABLE" }
    });
    return ok({ project: { ...project, availableCount, canManage: manageable } });
  });
}

export function PATCH(request: NextRequest, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const current = await prisma.project.findUnique({ where: { id: params.id } });
    if (!current) throw new ApiError("项目不存在", 404, "PROJECT_NOT_FOUND");
    if (!canManageProject(user, current.ownerId)) throw new ApiError("无权操作该项目", 403, "PERMISSION_DENIED");

    const body = projectUpdateSchema.parse(await request.json());
    const data: Prisma.ProjectUpdateInput = {};
    const nextText = {
      name: body.name !== undefined ? cleanText(body.name) : current.name,
      description: body.description !== undefined ? cleanText(body.description) : current.description,
      content: body.content !== undefined ? cleanText(body.content) : current.content,
      instructions: body.instructions !== undefined ? cleanText(body.instructions) : current.instructions
    };
    if (body.name !== undefined) data.name = nextText.name;
    if (body.description !== undefined) data.description = nextText.description;
    if (body.content !== undefined) data.content = nextText.content;
    if (body.instructions !== undefined) data.instructions = nextText.instructions;
    if (body.coverImage !== undefined) data.coverImage = body.coverImage || null;
    if (body.status !== undefined) data.status = body.status;
    if (body.visibility !== undefined) data.visibility = body.visibility;
    if (body.claimMode !== undefined) data.claimMode = body.claimMode;
    if (body.lotteryProbability !== undefined) data.lotteryProbability = body.lotteryProbability;
    if (body.requireLogin !== undefined) data.requireLogin = body.requireLogin;
    if (body.startAt !== undefined) data.startAt = body.startAt;
    if (body.endAt !== undefined) data.endAt = body.endAt;
    if (body.dailyLimit !== undefined) data.dailyLimit = body.dailyLimit;
    if (body.totalLimit !== undefined) data.totalLimit = body.totalLimit;
    if (body.perUserLimit !== undefined) data.perUserLimit = body.perUserLimit;
    if (body.illegalConfirmed !== undefined) data.illegalConfirmed = body.illegalConfirmed;

    if (user.role !== "ADMIN") {
      const review = await reviewProjectSubmission({
        fields: projectReviewFields(nextText),
        illegalConfirmed: body.illegalConfirmed ?? current.illegalConfirmed,
        actorRole: user.role
      });
      data.reviewStatus = review.reviewStatus;
      data.reviewReason = review.reviewReason;
    }

    if (user.role === "ADMIN") {
      if (body.reviewStatus !== undefined) data.reviewStatus = body.reviewStatus;
      if (body.reviewReason !== undefined) data.reviewReason = body.reviewReason;
    }

    const project = await prisma.project.update({ where: { id: params.id }, data });
    return ok({ project });
  });
}

export function DELETE(_request: NextRequest, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const current = await prisma.project.findUnique({ where: { id: params.id } });
    if (!current) throw new ApiError("项目不存在", 404, "PROJECT_NOT_FOUND");
    if (!canManageProject(user, current.ownerId)) throw new ApiError("无权操作该项目", 403, "PERMISSION_DENIED");
    await prisma.project.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  });
}
