import { redirect } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { dateTimeLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MyClaimsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const claims = await prisma.claim.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { id: true, name: true, instructions: true } }, cdk: { select: { code: true } } }
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">我的领取记录</h1>
        <p className="mt-2 text-ink/60">这里可以查看你领取过的 CDK。</p>
      </div>
      <Card className="overflow-hidden">
        {claims.length === 0 ? (
          <div className="p-5">
            <EmptyState title="暂无领取记录" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-paper text-ink/60">
                <tr>
                  <th className="p-3">项目</th>
                  <th className="p-3">CDK</th>
                  <th className="p-3">领取时间</th>
                  <th className="p-3">使用说明</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id} className="border-t border-line">
                    <td className="p-3">{claim.project.name}</td>
                    <td className="break-all p-3 font-mono">{claim.cdk.code}</td>
                    <td className="p-3">{dateTimeLabel(claim.createdAt)}</td>
                    <td className="max-w-sm whitespace-pre-wrap p-3 text-ink/70">{claim.project.instructions || "暂无说明"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
