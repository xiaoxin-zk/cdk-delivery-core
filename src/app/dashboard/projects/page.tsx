import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge, Button, Card, EmptyState, statusTone } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MyProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    take: 50,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cdks: true, claims: true } } }
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">我的项目</h1>
          <p className="mt-2 text-ink/60">创建、编辑和维护自己的 CDK 项目。</p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            创建项目
          </Button>
        </Link>
      </div>
      {projects.length === 0 ? (
        <EmptyState title="还没有项目" text="点击创建项目开始分发 CDK。" />
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge tone={statusTone(project.status)}>{statusLabel(project.status)}</Badge>
                    <Badge tone={statusTone(project.reviewStatus)}>{statusLabel(project.reviewStatus)}</Badge>
                  </div>
                  <h2 className="text-xl font-semibold">{project.name}</h2>
                  <p className="mt-2 text-sm text-ink/60">{project.description}</p>
                  <p className="mt-3 text-xs text-ink/50">
                    CDK {project._count.cdks} / 领取 {project._count.claims}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link className="rounded border border-line px-3 py-2 text-sm hover:bg-paper" href={`/dashboard/projects/${project.id}/cdks`}>
                    CDK
                  </Link>
                  <Link className="rounded bg-ink px-3 py-2 text-sm text-white" href={`/dashboard/projects/${project.id}/edit`}>
                    编辑
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
