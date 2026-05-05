import Link from "next/link";
import { Search } from "lucide-react";
import { CoverImage } from "@/components/projects/CoverImage";
import { Badge, Card, EmptyState, Input, Select, statusTone } from "@/components/ui";
import { statusLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: { search?: string; status?: string; page?: string };
}) {
  const search = searchParams.search?.trim();
  const status = searchParams.status;
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const pageSize = 12;
  const where = {
    visibility: "PUBLIC" as const,
    reviewStatus: "APPROVED" as const,
    status: status && ["PUBLIC", "PAUSED", "ENDED"].includes(status) ? (status as never) : undefined,
    OR: search
      ? [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } }
        ]
      : undefined
  };
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { cdks: true, claims: true } } }
    }),
    prisma.project.count({ where })
  ]);
  const pageCount = Math.ceil(total / pageSize);
  const baseParams = new URLSearchParams();
  if (search) baseParams.set("search", search);
  if (status) baseParams.set("status", status);
  function pageHref(nextPage: number) {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(nextPage));
    return `/projects?${params.toString()}`;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">公开项目</h1>
        <p className="mt-2 text-ink/60">领取前不会展示具体 CDK 内容。</p>
      </div>
      <form className="mb-6 grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-[1fr_180px_auto]" action="/projects">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink/40" />
          <Input className="pl-9" name="search" defaultValue={search ?? ""} placeholder="搜索项目" />
        </div>
        <Select name="status" defaultValue={status ?? ""}>
          <option value="">全部状态</option>
          <option value="PUBLIC">公开</option>
          <option value="PAUSED">暂停</option>
          <option value="ENDED">结束</option>
        </Select>
        <button className="rounded bg-ink px-4 py-2 text-sm font-medium text-white">筛选</button>
      </form>

      {projects.length === 0 ? (
        <EmptyState title="没有匹配项目" text="清空搜索条件后再试试。" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="block h-full">
              <Card className="h-full overflow-hidden transition hover:-translate-y-0.5">
                <CoverImage src={project.coverImage} alt={`${project.name}封面图`} className="rounded-none" />
                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge tone={statusTone(project.status)}>{statusLabel(project.status)}</Badge>
                    <span className="text-xs text-ink/55">剩余不会泄露具体内容</span>
                  </div>
                  <h2 className="text-lg font-semibold">{project.name}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink/65">{project.description}</p>
                  <div className="mt-5 flex gap-4 text-xs text-ink/55">
                    <span>CDK {project._count.cdks}</span>
                    <span>领取 {project._count.claims}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {pageCount > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link className="rounded border border-line bg-white px-4 py-2 hover:bg-paper" href={pageHref(page - 1)}>
              上一页
            </Link>
          ) : null}
          <span className="text-ink/60">
            第 {page} / {pageCount} 页
          </span>
          {page < pageCount ? (
            <Link className="rounded border border-line bg-white px-4 py-2 hover:bg-paper" href={pageHref(page + 1)}>
              下一页
            </Link>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
