import { startOfDay } from "date-fns";
import Link from "next/link";
import { Card, Badge, statusTone } from "@/components/ui";
import { statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const today = startOfDay(new Date());
  const [users, projects, cdks, todayClaims, recentUsers, recentProjects, recentClaims] = await Promise.all([
    prisma.user.count({ where: { status: { not: "DELETED" } } }),
    prisma.project.count(),
    prisma.cdk.count(),
    prisma.claim.count({ where: { createdAt: { gte: today } } }),
    prisma.user.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    prisma.project.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { owner: true } }),
    prisma.claim.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { project: true, user: true } })
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">后台仪表盘</h1>
        <p className="mt-2 text-ink/60">全站运行和安全管理概览。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="用户总数" value={users} />
        <Stat title="项目总数" value={projects} />
        <Stat title="CDK 总数" value={cdks} />
        <Stat title="今日领取" value={todayClaims} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">最近注册用户</h2>
          <List items={recentUsers.map((user) => ({ href: `/admin/users/${user.id}`, title: user.email, meta: statusLabel(user.role) }))} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">最近创建项目</h2>
          <div className="grid gap-2">
            {recentProjects.map((project) => (
              <Link key={project.id} className="rounded border border-line p-3 hover:bg-paper" href={`/admin/projects/${project.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{project.name}</span>
                  <Badge tone={statusTone(project.reviewStatus)}>{statusLabel(project.reviewStatus)}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink/55">{project.owner.email}</p>
              </Link>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">最近领取记录</h2>
          <div className="grid gap-2 text-sm">
            {recentClaims.map((claim) => (
              <div key={claim.id} className="rounded border border-line p-3">
                <p className="font-medium">{claim.project.name}</p>
                <p className="text-xs text-ink/55">{claim.user?.email ?? claim.emailOrIdentifier ?? "游客"}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-ink/55">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </Card>
  );
}

function List({ items }: { items: Array<{ href: string; title: string; meta: string }> }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Link key={item.href} className="rounded border border-line p-3 hover:bg-paper" href={item.href}>
          <p className="font-medium">{item.title}</p>
          <p className="mt-1 text-xs text-ink/55">{item.meta}</p>
        </Link>
      ))}
    </div>
  );
}
