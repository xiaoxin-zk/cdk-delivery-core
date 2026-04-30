import { Badge, Card, EmptyState } from "@/components/ui";
import { claimAttemptResultLabel, claimModeLabel, dateTimeLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminClaimsPage() {
  const attempts = await prisma.claimAttempt.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { project: true, user: true, cdk: true }
  });
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">领取记录</h1>
        <p className="mt-2 text-ink/60">查看成功领取、抽奖中奖、抽奖未中奖、时间、IP 和 User-Agent。</p>
      </div>
      <Card className="overflow-x-auto">
        {attempts.length === 0 ? <div className="p-5"><EmptyState title="暂无领取记录" /></div> : (
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-paper text-ink/60"><tr><th className="p-3">项目</th><th className="p-3">记录类型</th><th className="p-3">模式来源</th><th className="p-3">领取人</th><th className="p-3">是否发放 CDK</th><th className="p-3">CDK</th><th className="p-3">IP</th><th className="p-3">User-Agent</th><th className="p-3">时间</th></tr></thead>
            <tbody>{attempts.map((attempt) => (
              <tr key={attempt.id} className="border-t border-line">
                <td className="p-3">{attempt.project.name}</td>
                <td className="p-3"><Badge tone={attempt.result === "WON" ? "green" : "neutral"}>{claimAttemptResultLabel(attempt.result)}</Badge></td>
                <td className="p-3">{claimModeLabel(attempt.claimModeSnapshot)}</td>
                <td className="p-3">{attempt.user?.email ?? attempt.emailOrIdentifier ?? "游客"}</td>
                <td className="p-3"><Badge tone={attempt.cdk ? "green" : "yellow"}>{attempt.cdk ? "是" : "否"}</Badge></td>
                <td className="max-w-xs break-all p-3 font-mono">{attempt.cdk?.code ?? "-"}</td>
                <td className="p-3">{attempt.ip ?? "-"}</td>
                <td className="max-w-xs truncate p-3">{attempt.userAgent ?? "-"}</td>
                <td className="p-3">{dateTimeLabel(attempt.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
