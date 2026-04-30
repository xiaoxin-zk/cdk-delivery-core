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
    const role = url.searchParams.get("role");
    const status = url.searchParams.get("status");
    const where: Prisma.UserWhereInput = {
      email: search ? { contains: search, mode: "insensitive" } : undefined,
      role: role && ["USER", "ADMIN"].includes(role) ? (role as never) : undefined,
      status: status && ["ACTIVE", "DISABLED", "DELETED"].includes(status) ? (status as never) : undefined
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          _count: { select: { projects: true, claims: true } }
        }
      }),
      prisma.user.count({ where })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}
