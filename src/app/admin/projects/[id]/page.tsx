import { notFound } from "next/navigation";
import { AdminProjectActions } from "@/components/admin/AdminProjectActions";
import { CoverImage } from "@/components/projects/CoverImage";
import { Badge, Card, EmptyState, statusTone } from "@/components/ui";
import { booleanLabel, claimAttemptResultLabel, claimModeDescription, claimModeLabel, dateTimeLabel, limitLabel, statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, email: true, role: true, status: true, createdAt: true } },
      claims: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true } }, cdk: { select: { code: true, status: true } } }
      },
      claimAttempts: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true } }, cdk: { select: { code: true, status: true } } }
      }
    }
  });
  if (!project) notFound();

  const [totalCdks, availableCdks, claimedCdks, disabledCdks, recentCdks] = await Promise.all([
    prisma.cdk.count({ where: { projectId: project.id } }),
    prisma.cdk.count({ where: { projectId: project.id, status: "AVAILABLE" } }),
    prisma.cdk.count({ where: { projectId: project.id, status: "CLAIMED" } }),
    prisma.cdk.count({ where: { projectId: project.id, status: "DISABLED" } }),
    prisma.cdk.findMany({
      where: { projectId: project.id },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { claimer: { select: { email: true } } }
    })
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">{project.name}</h1>
        <p className="mt-2 text-ink/60">后台项目详情、审核和 CDK 分发管理。</p>
      </div>

      <Card className="overflow-hidden">
        <CoverImage src={project.coverImage} alt={`${project.name}封面图`} className="rounded-none" />
        <div className="p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge tone={statusTone(project.status)}>{statusLabel(project.status)}</Badge>
            <Badge tone={statusTone(project.reviewStatus)}>{statusLabel(project.reviewStatus)}</Badge>
            <Badge tone={statusTone(project.visibility)}>{statusLabel(project.visibility)}</Badge>
          </div>
          <p className="text-sm leading-6 text-ink/70">{project.description}</p>
          {project.reviewReason ? <p className="mt-3 text-sm text-ember">审核原因：{project.reviewReason}</p> : null}
          <div className="mt-5">
            <AdminProjectActions projectId={project.id} status={project.status} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="CDK 总数" value={totalCdks} />
        <Stat title="未领取" value={availableCdks} />
        <Stat title="已领取" value={claimedCdks} />
        <Stat title="已禁用" value={disabledCdks} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">基础信息</h2>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="项目名称" value={project.name} />
            <Info label="创建者" value={project.owner.email} />
            <Info label="创建者状态" value={statusLabel(project.owner.status)} />
            <Info label="创建时间" value={dateTimeLabel(project.createdAt)} />
            <Info label="更新时间" value={dateTimeLabel(project.updatedAt)} />
            <Info label="审核状态" value={statusLabel(project.reviewStatus)} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">领取规则</h2>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="领取模式" value={claimModeLabel(project.claimMode)} />
            <Info label="模式说明" value={claimModeDescription(project.claimMode)} />
            <Info label="抽奖中奖概率" value={project.claimMode === "LOTTERY" ? `${project.lotteryProbability}%` : "不适用"} />
            <Info label="需要登录" value={booleanLabel(project.requireLogin)} />
            <Info label="公开展示" value={statusLabel(project.visibility)} />
            <Info label="领取时间范围" value={`${dateTimeLabel(project.startAt)} 至 ${dateTimeLabel(project.endAt)}`} />
            <Info label="每日领取限制" value={limitLabel(project.dailyLimit)} />
            <Info label="总领取限制" value={limitLabel(project.totalLimit)} />
            <Info label="单用户领取限制" value={limitLabel(project.perUserLimit)} />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">项目内容</h2>
        <p className="whitespace-pre-wrap text-sm leading-7 text-ink/70">{project.content}</p>
        <h3 className="mb-2 mt-5 font-semibold">使用说明</h3>
        <p className="whitespace-pre-wrap text-sm leading-7 text-ink/70">{project.instructions || "暂无说明"}</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">最近参与记录</h2>
          {project.claimAttempts.length === 0 ? (
            <EmptyState title="暂无参与记录" />
          ) : (
            <div className="grid gap-2 text-sm">
              {project.claimAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded border border-line p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>{attempt.user?.email ?? attempt.emailOrIdentifier ?? "游客"}</span>
                    <span className="text-ink/55">{dateTimeLabel(attempt.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-xs text-ink/60">记录类型：{claimAttemptResultLabel(attempt.result)}</p>
                  <p className="mt-1 text-xs text-ink/60">是否发放 CDK：{attempt.cdk ? "是" : "否"}</p>
                  <p className="mt-1 break-all font-mono text-xs text-ink/60">{attempt.cdk?.code ?? "-"}</p>
                  <p className="mt-1 text-xs text-ink/50">IP：{attempt.ip ?? "-"}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">最近上传的 CDK</h2>
          {recentCdks.length === 0 ? (
            <EmptyState title="暂无 CDK" />
          ) : (
            <div className="grid gap-2 text-sm">
              {recentCdks.map((cdk) => (
                <div key={cdk.id} className="rounded border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="break-all font-mono">{cdk.code}</span>
                    <Badge tone={statusTone(cdk.status)}>{statusLabel(cdk.status)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink/50">
                    上传时间：{dateTimeLabel(cdk.createdAt)} {cdk.claimer ? ` / 领取人：${cdk.claimer.email}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-ink/55">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-paper p-3">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 font-medium text-ink">{value}</p>
    </div>
  );
}
