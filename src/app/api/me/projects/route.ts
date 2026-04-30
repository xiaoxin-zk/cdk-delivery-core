import { NextRequest } from "next/server";
import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getPagination, pageResult } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return route(async () => {
    const user = await requireUser();
    const { page, pageSize, skip, take } = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where: { ownerId: user.id },
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { cdks: true, claims: true } } }
      }),
      prisma.project.count({ where: { ownerId: user.id } })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}
