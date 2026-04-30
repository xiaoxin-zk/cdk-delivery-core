import { notFound } from "next/navigation";
import { AdminUserForm } from "@/components/admin/AdminUserForm";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const actor = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      projects: { take: 10, orderBy: { createdAt: "desc" } },
      claims: { take: 10, orderBy: { createdAt: "desc" }, include: { project: true } }
    }
  });
  if (!user) notFound();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">用户详情</h1>
        <p className="mt-2 text-ink/60">{user.email}</p>
      </div>
      <AdminUserForm user={user} currentAdminId={actor.id} />
      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">用户项目</h2>
        <div className="grid gap-2 text-sm">
          {user.projects.map((project) => (
            <a key={project.id} className="rounded border border-line p-3 hover:bg-paper" href={`/admin/projects/${project.id}`}>
              {project.name}
            </a>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">领取记录</h2>
        <div className="grid gap-2 text-sm">
          {user.claims.map((claim) => (
            <div key={claim.id} className="rounded border border-line p-3">
              {claim.project.name} · {claim.createdAt.toLocaleString()}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
