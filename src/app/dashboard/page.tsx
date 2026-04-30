import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, statusTone } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [projects, cdks, claims, recentProjects] = await Promise.all([
    prisma.project.count({ where: { ownerId: user.id } }),
    prisma.cdk.count({ where: { project: { ownerId: user.id } } }),
    prisma.claim.count({ where: { userId: user.id } }),
    prisma.project.findMany({
      where: { ownerId: user.id },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { cdks: true, claims: true } } }
    })
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">控制台</h1>
        <p className="mt-2 text-ink/60">管理你的 CDK 分发项目和领取记录。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat title="我的项目" value={projects} />
        <Stat title="我的 CDK" value={cdks} />
        <Stat title="领取记录" value={claims} />
      </div>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">最近项目</h2>
          <Link className="text-sm text-accent" href="/dashboard/projects">
            全部项目
          </Link>
        </div>
        {recentProjects.length === 0 ? (
          <EmptyState title="还没有项目" text="创建第一个分发项目后会显示在这里。" />
        ) : (
          <div className="grid gap-3">
            {recentProjects.map((project) => (
              <Link key={project.id} className="rounded border border-line p-4 hover:bg-paper" href={`/dashboard/projects/${project.id}/edit`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="mt-1 text-sm text-ink/60">
                      CDK {project._count.cdks} / 领取 {project._count.claims}
                    </p>
                  </div>
                  <Badge tone={statusTone(project.status)}>{statusLabel(project.status)}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
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
