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
    const where = { userId: user.id };
    const [items, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true, instructions: true } },
          cdk: { select: { id: true, code: true, status: true } }
        }
      }),
      prisma.claim.count({ where })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}
