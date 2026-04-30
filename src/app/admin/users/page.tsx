import Link from "next/link";
import { Badge, Card, EmptyState, statusTone } from "@/components/ui";
import { statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    where: { status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, email: true, role: true, status: true, emailVerified: true, createdAt: true, _count: { select: { projects: true, claims: true } } }
  });
  return (
    <AdminTablePage title="用户管理" description="查看、禁用、授权、重置密码和软删除用户。">
      {users.length === 0 ? (
        <EmptyState title="暂无用户" />
      ) : (
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-paper text-ink/60">
            <tr>
              <th className="p-3">邮箱</th>
              <th className="p-3">角色</th>
              <th className="p-3">状态</th>
              <th className="p-3">项目 / 领取</th>
              <th className="p-3">注册时间</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="p-3">
                  <Link className="font-medium text-accent" href={`/admin/users/${user.id}`}>
                    {user.email}
                  </Link>
                </td>
                <td className="p-3">{statusLabel(user.role)}</td>
                <td className="p-3">
                  <Badge tone={statusTone(user.status)}>{statusLabel(user.status)}</Badge>
                </td>
                <td className="p-3">{user._count.projects} / {user._count.claims}</td>
                <td className="p-3">{user.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminTablePage>
  );
}

function AdminTablePage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-ink/60">{description}</p>
      </div>
      <Card className="overflow-x-auto">{children}</Card>
    </div>
  );
}
