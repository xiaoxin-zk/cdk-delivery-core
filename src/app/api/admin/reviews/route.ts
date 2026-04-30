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
    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where: { reviewStatus: "PENDING" },
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        include: { owner: { select: { id: true, email: true } } }
      }),
      prisma.project.count({ where: { reviewStatus: "PENDING" } })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}
