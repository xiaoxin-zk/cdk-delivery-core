import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { ok, route } from "@/lib/api";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getPagination, pageResult } from "@/lib/pagination";
import { projectReviewFields, reviewProjectSubmission } from "@/lib/project-review";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { enforceRateLimit } from "@/lib/rate-limit";
import { cleanText } from "@/lib/security";
import { verifyTurnstile } from "@/lib/turnstile";
import { projectSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return route(async () => {
    const { page, pageSize, skip, take } = getPagination(request);
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const status = url.searchParams.get("status")?.trim();

    const where: Prisma.ProjectWhereInput = {
      visibility: "PUBLIC",
      reviewStatus: "APPROVED",
      status: status && ["PUBLIC", "PAUSED", "ENDED"].includes(status) ? (status as never) : undefined,
      OR: search
        ? [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } }
          ]
        : undefined
    };

    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { id: true, email: true } },
          _count: { select: { claims: true, cdks: true } }
        }
      }),
      prisma.project.count({ where })
    ]);

    const availableCounts = await prisma.cdk.groupBy({
      by: ["projectId"],
      where: { projectId: { in: items.map((item) => item.id) }, status: "AVAILABLE" },
      _count: { id: true }
    });
    const availableMap = new Map(availableCounts.map((item) => [item.projectId, item._count.id]));

    return ok(
      pageResult(
        items.map((item) => ({
          ...item,
          availableCount: availableMap.get(item.id) ?? 0
        })),
        total,
        page,
        pageSize
      )
    );
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const user = await requireUser();
    const ip = getClientIp(request);
    await enforceRateLimit(`project:create:${user.id}:${ip}`, 10, 3600);
    const body = projectSchema.parse(await request.json());
    await verifyTurnstile("create-project", body.turnstileToken, ip);

    const safe = {
      name: cleanText(body.name),
      description: cleanText(body.description),
      content: cleanText(body.content),
      instructions: cleanText(body.instructions ?? "")
    };

    const review = await reviewProjectSubmission({
      fields: projectReviewFields(safe),
      illegalConfirmed: body.illegalConfirmed,
      actorRole: user.role
    });

    const project = await prisma.project.create({
      data: {
        ownerId: user.id,
        ...safe,
        coverImage: body.coverImage || null,
        status: body.status,
        visibility: body.visibility,
        claimMode: body.claimMode,
        lotteryProbability: body.lotteryProbability,
        requireLogin: body.requireLogin,
        startAt: body.startAt,
        endAt: body.endAt,
        dailyLimit: body.dailyLimit,
        totalLimit: body.totalLimit,
        perUserLimit: body.perUserLimit,
        illegalConfirmed: body.illegalConfirmed,
        reviewStatus: review.reviewStatus,
        reviewReason: review.reviewReason
      }
    });

    return ok({ project }, 201);
  });
}
