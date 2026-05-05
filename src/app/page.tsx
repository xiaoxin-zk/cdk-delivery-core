import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Card, Badge, statusTone } from "@/components/ui";
import { statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await prisma.project.findMany({
    where: { visibility: "PUBLIC", status: "PUBLIC", reviewStatus: "APPROVED" },
    take: 6,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cdks: true, claims: true } } }
  });

  return (
    <main>
      <section className="border-b border-line bg-ink text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded bg-white/10 px-3 py-1 text-sm">
              <Sparkles className="h-4 w-4" />
              兑换码 / 礼品码 / 激活码服务
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">让兑换码发放更简单、更清楚</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/76">
              面向活动运营、产品兑换、福利发放等场景，统一管理兑换码库存、领取规则和发放记录，用户按项目自助领取。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="inline-flex items-center rounded bg-white px-5 py-3 font-medium text-ink" href="/dashboard/projects/new">
                创建项目
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link className="inline-flex items-center rounded border border-white/25 px-5 py-3 font-medium" href="/projects">
                浏览公开项目
              </Link>
            </div>
          </div>
          <div className="grid content-end gap-3">
            {["创建发放项目", "导入兑换码库存", "设置领取规则", "查看领取记录"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded border border-white/15 bg-white/8 p-4">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">最新公开项目</h2>
          <Link className="text-sm font-medium text-accent" href="/projects">
            查看全部
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full p-5 transition hover:-translate-y-0.5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge tone={statusTone(project.status)}>{statusLabel(project.status)}</Badge>
                  <span className="text-xs text-ink/55">{project._count.claims} 次领取</span>
                </div>
                <h3 className="text-lg font-semibold">{project.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink/65">{project.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
