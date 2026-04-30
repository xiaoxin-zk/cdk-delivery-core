import Link from "next/link";
import { AdminProjectActions } from "@/components/admin/AdminProjectActions";
import { Badge, Card, EmptyState, statusTone } from "@/components/ui";
import { dateTimeLabel, statusLabel } from "@/lib/labels";
import { extractReviewMatchedFields } from "@/lib/project-review";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const projects = await prisma.project.findMany({
    where: { reviewStatus: "PENDING" },
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { email: true } } }
  });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">审核管理</h1>
        <p className="mt-2 text-ink/60">处理待审核项目和敏感词命中项目。</p>
      </div>
      {projects.length === 0 ? <EmptyState title="暂无待审核项目" /> : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Link className="text-lg font-semibold text-accent" href={`/admin/projects/${project.id}`}>{project.name}</Link>
                    <Badge tone={statusTone(project.reviewStatus)}>{statusLabel(project.reviewStatus)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">{project.owner.email}</p>
                  <p className="mt-1 text-sm text-ink/60">提交时间：{dateTimeLabel(project.updatedAt)}</p>
                  <p className="mt-1 text-sm text-ink/60">
                    命中字段：{extractReviewMatchedFields(project.reviewReason).join("、") || "无"}
                  </p>
                  {project.reviewReason ? <p className="mt-2 text-sm text-ember">{project.reviewReason}</p> : null}
                </div>
                <AdminProjectActions projectId={project.id} status={project.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
