import { notFound, redirect } from "next/navigation";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.ownerId !== user.id && user.role !== "ADMIN")) notFound();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">编辑项目</h1>
        <p className="mt-2 text-ink/60">保存后，命中审核策略的项目会进入待审核。</p>
      </div>
      <ProjectForm initial={project} settings={await getPublicSettings()} />
    </div>
  );
}
