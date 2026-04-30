import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CdkManager } from "@/components/projects/CdkManager";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProjectCdksPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.ownerId !== user.id && user.role !== "ADMIN")) notFound();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">CDK 管理</h1>
          <p className="mt-2 text-ink/60">{project.name}</p>
        </div>
        <Link className="rounded border border-line bg-white px-3 py-2 text-sm hover:bg-paper" href={`/dashboard/projects/${project.id}/edit`}>
          编辑项目
        </Link>
      </div>
      <CdkManager projectId={project.id} />
    </div>
  );
}
