import Link from "next/link";
import { Badge, Card, EmptyState, statusTone } from "@/components/ui";
import { statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const projects = await prisma.project.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { email: true } }, _count: { select: { cdks: true, claims: true } } }
  });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">项目管理</h1>
        <p className="mt-2 text-ink/60">审核、禁用和维护所有用户项目。</p>
      </div>
      <Card className="overflow-x-auto">
        {projects.length === 0 ? (
          <div className="p-5"><EmptyState title="暂无项目" /></div>
        ) : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-paper text-ink/60">
              <tr>
                <th className="p-3">项目</th>
                <th className="p-3">创建者</th>
                <th className="p-3">状态</th>
                <th className="p-3">审核</th>
                <th className="p-3">CDK / 领取</th>
                <th className="p-3">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t border-line">
                  <td className="p-3">
                    <Link className="font-medium text-accent" href={`/admin/projects/${project.id}`}>
                      {project.name}
                    </Link>
                  </td>
                  <td className="p-3">{project.owner.email}</td>
                  <td className="p-3"><Badge tone={statusTone(project.status)}>{statusLabel(project.status)}</Badge></td>
                  <td className="p-3"><Badge tone={statusTone(project.reviewStatus)}>{statusLabel(project.reviewStatus)}</Badge></td>
                  <td className="p-3">{project._count.cdks} / {project._count.claims}</td>
                  <td className="p-3">{project.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
