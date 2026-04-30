import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getPagination, pageResult } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return route(async () => {
    await requireAdmin();
    const { page, pageSize, skip, take } = getPagination(request);
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const reviewStatus = url.searchParams.get("reviewStatus");
    const status = url.searchParams.get("status");
    const where: Prisma.ProjectWhereInput = {
      reviewStatus: reviewStatus && ["PENDING", "APPROVED", "REJECTED"].includes(reviewStatus) ? (reviewStatus as never) : undefined,
      status: status && ["DRAFT", "PUBLIC", "PAUSED", "ENDED", "DISABLED"].includes(status) ? (status as never) : undefined,
      OR: search
        ? [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { owner: { email: { contains: search, mode: "insensitive" } } }
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
          _count: { select: { cdks: true, claims: true } }
        }
      }),
      prisma.project.count({ where })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}
