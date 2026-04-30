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
    const where: Prisma.ClaimWhereInput = search
      ? {
          OR: [
            { emailOrIdentifier: { contains: search, mode: "insensitive" } },
            { project: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {};
    const [items, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true } },
          user: { select: { id: true, email: true } },
          cdk: { select: { id: true, code: true, status: true } }
        }
      }),
      prisma.claim.count({ where })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}
