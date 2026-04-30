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
    const status = url.searchParams.get("status");
    const where: Prisma.CdkWhereInput = {
      status: status && ["AVAILABLE", "CLAIMED", "DISABLED"].includes(status) ? (status as never) : undefined,
      OR: search
        ? [
            { code: { contains: search, mode: "insensitive" } },
            { project: { name: { contains: search, mode: "insensitive" } } }
          ]
        : undefined
    };
    const [items, total] = await Promise.all([
      prisma.cdk.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true } },
          claimer: { select: { id: true, email: true } }
        }
      }),
      prisma.cdk.count({ where })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}
