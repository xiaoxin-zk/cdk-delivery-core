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
    const search = new URL(request.url).searchParams.get("search")?.trim();
    const where: Prisma.AuditLogWhereInput = search
      ? {
          OR: [
            { action: { contains: search, mode: "insensitive" } },
            { targetType: { contains: search, mode: "insensitive" } },
            { actor: { email: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {};
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, email: true } } }
      }),
      prisma.auditLog.count({ where })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}
