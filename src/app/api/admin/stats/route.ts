import { startOfDay } from "date-fns";
import { ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export function GET() {
  return route(async () => {
    await requireAdmin();
    const today = startOfDay(new Date());
    const [
      users,
      projects,
      cdks,
      todayClaims,
      recentUsers,
      recentProjects,
      recentClaims
    ] = await Promise.all([
      prisma.user.count({ where: { status: { not: "DELETED" } } }),
      prisma.project.count(),
      prisma.cdk.count(),
      prisma.claim.count({ where: { createdAt: { gte: today } } }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, status: true, createdAt: true }
      }),
      prisma.project.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { id: true, email: true } } }
      }),
      prisma.claim.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true } },
          user: { select: { id: true, email: true } }
        }
      })
    ]);
    return ok({ users, projects, cdks, todayClaims, recentUsers, recentProjects, recentClaims });
  });
}
