import { Badge, Card, EmptyState, statusTone } from "@/components/ui";
import { dateTimeLabel, statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCdksPage() {
  const cdks = await prisma.cdk.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { project: { select: { name: true } }, claimer: { select: { email: true } } }
  });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">CDK 管理</h1>
        <p className="mt-2 text-ink/60">查看全站 CDK 状态和领取人。</p>
      </div>
      <Card className="overflow-x-auto">
        {cdks.length === 0 ? <div className="p-5"><EmptyState title="暂无 CDK" /></div> : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-paper text-ink/60"><tr><th className="p-3">CDK</th><th className="p-3">项目</th><th className="p-3">状态</th><th className="p-3">领取人</th><th className="p-3">领取时间</th><th className="p-3">上传时间</th></tr></thead>
            <tbody>{cdks.map((cdk) => (
              <tr key={cdk.id} className="border-t border-line">
                <td className="max-w-xs break-all p-3 font-mono">{cdk.code}</td>
                <td className="p-3">{cdk.project.name}</td>
                <td className="p-3"><Badge tone={statusTone(cdk.status)}>{statusLabel(cdk.status)}</Badge></td>
                <td className="p-3">{cdk.claimer?.email ?? "-"}</td>
                <td className="p-3">{cdk.claimedAt ? dateTimeLabel(cdk.claimedAt) : "-"}</td>
                <td className="p-3">{dateTimeLabel(cdk.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
