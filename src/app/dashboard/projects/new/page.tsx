import { ProjectForm } from "@/components/projects/ProjectForm";
import { getPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">创建项目</h1>
        <p className="mt-2 text-ink/60">填写基础信息、领取规则和安全确认。</p>
      </div>
      <ProjectForm settings={await getPublicSettings()} />
    </div>
  );
}
