import { notFound } from "next/navigation";
import { CoverImage } from "@/components/projects/CoverImage";
import { Badge, Card, statusTone } from "@/components/ui";
import { ClaimPanel } from "@/components/projects/ClaimPanel";
import { getCurrentUser } from "@/lib/auth";
import { getClaimUnavailableReason } from "@/lib/claims";
import { booleanLabel, claimModeDescription, claimModeLabel, claimRuleDescription, dateTimeLabel, limitLabel, statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const [project, user, settings] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
      include: { owner: { select: { email: true } }, _count: { select: { claims: true } } }
    }),
    getCurrentUser(),
    getPublicSettings()
  ]);
  if (!project) notFound();
  const canManage = user?.role === "ADMIN" || user?.id === project.ownerId;
  if ((project.visibility !== "PUBLIC" || project.reviewStatus !== "APPROVED") && !canManage) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <Card className="p-6 text-center">
          <h1 className="text-2xl font-semibold">该项目暂不可访问</h1>
          <p className="mt-3 text-sm leading-6 text-ink/65">项目可能尚未审核通过、已设为私有或暂时不可公开访问。</p>
        </Card>
      </main>
    );
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const claimModeWhere = { projectId: project.id, claimModeSnapshot: project.claimMode };
  const lotteryAttemptWhere = { projectId: project.id, claimModeSnapshot: "LOTTERY" as const };
  const [availableCount, totalCdkCount, totalAttempts, todayClaims, todayAttempts, userClaims, userAttempts, latestUserClaim] = await Promise.all([
    prisma.cdk.count({ where: { projectId: project.id, status: "AVAILABLE" } }),
    prisma.cdk.count({ where: { projectId: project.id } }),
    prisma.claimAttempt.count({ where: lotteryAttemptWhere }),
    prisma.claim.count({ where: { ...claimModeWhere, createdAt: { gte: today } } }),
    prisma.claimAttempt.count({ where: { ...lotteryAttemptWhere, createdAt: { gte: today } } }),
    user
      ? prisma.claim.count({ where: { ...claimModeWhere, userId: user.id } })
      : Promise.resolve(0),
    user
      ? prisma.claimAttempt.count({ where: { ...lotteryAttemptWhere, userId: user.id } })
      : Promise.resolve(0),
    user
      ? prisma.claim.findFirst({
          where: { projectId: project.id, userId: user.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, cdk: { select: { code: true } } }
        })
      : Promise.resolve(null)
  ]);
  const unavailableReason = getClaimUnavailableReason(project, {
    loggedIn: Boolean(user),
    availableCount,
    totalClaims: project.claimMode === "LOTTERY" ? totalAttempts : project._count.claims,
    todayClaims: project.claimMode === "LOTTERY" ? todayAttempts : todayClaims,
    userClaims,
    userAttempts
  });

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
      <section className="grid gap-6">
        <Card className="overflow-hidden">
          <CoverImage src={project.coverImage} alt={`${project.name}封面图`} className="rounded-none" />
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(project.status)}>{statusLabel(project.status)}</Badge>
              <Badge tone={statusTone(project.reviewStatus)}>{statusLabel(project.reviewStatus)}</Badge>
              <span className="text-sm text-ink/55">创建者 {project.owner.email}</span>
            </div>
            <h1 className="text-3xl font-semibold">{project.name}</h1>
            <p className="mt-4 text-ink/70">{project.description}</p>
            {canManage && project.reviewStatus !== "APPROVED" ? (
              <div className="mt-4 rounded border border-line bg-paper p-3 text-sm leading-6 text-ink/75">
                <p>审核状态：{statusLabel(project.reviewStatus)}</p>
                <p>审核原因：{project.reviewReason || "等待管理员审核"}</p>
              </div>
            ) : null}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-semibold">领取规则</h2>
          <div className="grid gap-3 text-sm leading-6 text-ink/75 md:grid-cols-2">
            <Info label="领取模式" value={claimModeLabel(project.claimMode)} />
            <Info label="模式说明" value={claimModeDescription(project.claimMode)} />
            <Info label="规则说明" value={claimRuleDescription(project)} />
            <Info label="抽奖中奖概率" value={project.claimMode === "LOTTERY" ? `${project.lotteryProbability}%` : "不适用"} />
            <Info label="项目状态" value={statusLabel(project.status)} />
            <Info label="是否需要登录" value={booleanLabel(project.requireLogin)} />
            <Info label="总 CDK 数量" value={`${totalCdkCount} 个`} />
            <Info label="剩余 CDK 数量" value={`${availableCount} 个`} />
            <Info label="已领取数量" value={`${project._count.claims} 次`} />
            <Info label="领取时间范围" value={`${dateTimeLabel(project.startAt)} 至 ${dateTimeLabel(project.endAt)}`} />
            <Info label="每日领取限制" value={limitLabel(project.dailyLimit)} />
            <Info label="总领取限制" value={limitLabel(project.totalLimit)} />
            <Info label="单用户领取限制" value={limitLabel(project.perUserLimit)} />
            <Info label="创建时间" value={dateTimeLabel(project.createdAt)} />
          </div>
          {unavailableReason ? (
            <p className="mt-4 rounded border border-line bg-paper p-3 text-sm text-ink/70">当前不可领取：{unavailableReason}</p>
          ) : null}
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-semibold">项目介绍</h2>
          <p className="whitespace-pre-wrap leading-7 text-ink/75">{project.content}</p>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-semibold">使用说明</h2>
          <p className="whitespace-pre-wrap leading-7 text-ink/75">{project.instructions || "暂无说明"}</p>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-semibold">平台规则</h2>
          <p className="leading-7 text-ink/70">
            禁止诈骗、钓鱼、恶意软件、盗版、违法交易、攻击工具或其他违法违规内容。发现违规项目请联系站点管理员处理。
          </p>
        </Card>
      </section>

      <aside className="grid content-start gap-4">
        <Card className="grid grid-cols-2 gap-3 p-5 text-sm">
          <div>
            <p className="text-ink/55">剩余数量</p>
            <p className="mt-1 text-2xl font-semibold">{availableCount}</p>
          </div>
          <div>
            <p className="text-ink/55">总数量</p>
            <p className="mt-1 text-2xl font-semibold">{totalCdkCount}</p>
          </div>
          <div>
            <p className="text-ink/55">已领取</p>
            <p className="mt-1 text-2xl font-semibold">{project._count.claims}</p>
          </div>
          <div>
            <p className="text-ink/55">模式</p>
            <p className="mt-1 font-medium">{claimModeLabel(project.claimMode)}</p>
          </div>
          <div>
            <p className="text-ink/55">中奖概率</p>
            <p className="mt-1 font-medium">{project.claimMode === "LOTTERY" ? `${project.lotteryProbability}%` : "不适用"}</p>
          </div>
          <div>
            <p className="text-ink/55">登录要求</p>
            <p className="mt-1 font-medium">{project.requireLogin ? "需要登录" : "可游客领取"}</p>
          </div>
        </Card>
        <ClaimPanel
          projectId={project.id}
          requireLogin={project.requireLogin}
          isLoggedIn={Boolean(user)}
          settings={settings}
          claimMode={project.claimMode}
          instructions={project.instructions}
          disabledReason={unavailableReason}
          availableCount={availableCount}
          claimedCount={project._count.claims}
          userClaims={userClaims}
          userAttempts={userAttempts}
          perUserLimit={project.perUserLimit}
          initialResult={
            latestUserClaim
              ? {
                  code: latestUserClaim.cdk.code,
                  claimedAt: latestUserClaim.createdAt.toISOString()
                }
              : null
          }
        />
      </aside>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white p-3">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 font-medium text-ink">{value}</p>
    </div>
  );
}
