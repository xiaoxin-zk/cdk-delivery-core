import { Card, EmptyState } from "@/components/ui";
import { auditActionLabel, auditTargetLabel, dateTimeLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { email: true } } }
  });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">审计日志</h1>
        <p className="mt-2 text-ink/60">记录管理员关键操作。</p>
      </div>
      <Card className="overflow-x-auto">
        {logs.length === 0 ? <div className="p-5"><EmptyState title="暂无审计日志" /></div> : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-paper text-ink/60"><tr><th className="p-3">操作者</th><th className="p-3">动作</th><th className="p-3">目标</th><th className="p-3">IP</th><th className="p-3">时间</th></tr></thead>
            <tbody>{logs.map((log) => (
              <tr key={log.id} className="border-t border-line">
                <td className="p-3">{log.actor?.email ?? "系统"}</td>
                <td className="p-3">{auditActionLabel(log.action)}</td>
                <td className="p-3">{auditTargetLabel(log.targetType)} / {log.targetId ?? "-"}</td>
                <td className="p-3">{log.ip ?? "-"}</td>
                <td className="p-3">{dateTimeLabel(log.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
