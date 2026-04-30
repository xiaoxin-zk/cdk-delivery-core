"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/components/api";
import { Button } from "@/components/ui";

export function AdminProjectActions({ projectId, status }: { projectId: string; status: string }) {
  const router = useRouter();

  async function patch(reviewStatus: string, reviewReason?: string) {
    await api(`/api/admin/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ reviewStatus, reviewReason })
    });
    router.refresh();
  }

  async function approveProject() {
    if (!window.confirm("确认审核通过该项目？通过后项目在公开状态下可被用户查看和领取。")) return;
    await patch("APPROVED", "");
  }

  async function updateStatus(nextStatus: string, message: string) {
    if (!window.confirm(message)) return;
    await api(`/api/admin/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus })
    });
    router.refresh();
  }

  async function deleteProject() {
    if (!window.confirm("确认删除该项目？删除后项目、CDK 和领取记录都会被移除。")) return;
    await api(`/api/admin/projects/${projectId}`, { method: "DELETE" });
    router.push("/admin/projects");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={approveProject}>
        审核通过
      </Button>
      <Button
        type="button"
        variant="danger"
        onClick={() => {
          const reason = window.prompt("请输入拒绝原因");
          if (reason === null) return;
          void patch("REJECTED", reason || "管理员拒绝");
        }}
      >
        拒绝项目
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => updateStatus("PAUSED", "确认暂停该项目？暂停后用户将无法继续领取 CDK。")}
      >
        暂停项目
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => updateStatus("PUBLIC", "确认恢复该项目为公开领取？请确保内容和规则已经审核。")}
        disabled={status === "PUBLIC"}
      >
        恢复项目
      </Button>
      <Link className="inline-flex min-h-10 items-center rounded border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-paper" href={`/dashboard/projects/${projectId}/cdks`}>
        管理 CDK
      </Link>
      <Link className="inline-flex min-h-10 items-center rounded border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-paper" href="/admin/claims">
        查看领取记录
      </Link>
      <Button type="button" variant="danger" onClick={deleteProject}>
        删除项目
      </Button>
    </div>
  );
}
