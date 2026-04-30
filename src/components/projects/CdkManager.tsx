"use client";

import { Download, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/api";
import { Badge, Button, Card, EmptyState, Textarea, statusTone } from "@/components/ui";
import { dateTimeLabel, statusLabel } from "@/lib/labels";

type CdkItem = {
  id: string;
  code: string;
  status: string;
  claimedAt?: string | null;
  claimer?: { email: string } | null;
  claim?: { ip?: string | null; userAgent?: string | null; emailOrIdentifier?: string | null; createdAt: string } | null;
};

export function CdkManager({ projectId }: { projectId: string }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<CdkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ items: CdkItem[] }>(`/api/projects/${projectId}/cdks?pageSize=50`);
    setItems(data.items);
  }, [projectId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, [load]);

  async function importCdks() {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ imported: number }>(`/api/projects/${projectId}/cdks/import`, {
        method: "POST",
        body: JSON.stringify({ text })
      });
      setMessage(`已导入 ${result.imported} 条 CDK`);
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setLoading(false);
    }
  }

  async function disableCdk(id: string) {
    if (actionLoadingId) return;
    if (!window.confirm("确认禁用该 CDK？禁用后用户将无法领取它。")) return;
    setActionLoadingId(id);
    setError("");
    setMessage("");
    try {
      await api(`/api/cdks/${id}`, { method: "PATCH", body: JSON.stringify({ status: "DISABLED" }) });
      setMessage("CDK 已禁用");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "禁用失败");
    } finally {
      setActionLoadingId("");
    }
  }

  async function deleteCdk(id: string) {
    if (actionLoadingId) return;
    if (!window.confirm("确认删除该未领取 CDK？删除后不可恢复。")) return;
    setActionLoadingId(id);
    setError("");
    setMessage("");
    try {
      await api(`/api/cdks/${id}`, { method: "DELETE" });
      setMessage("CDK 已删除");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setActionLoadingId("");
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">批量导入 CDK</h2>
          <a
            className="inline-flex items-center rounded border border-line bg-white px-3 py-2 text-sm hover:bg-paper"
            href={`/api/projects/${projectId}/cdks/export`}
          >
            <Download className="mr-2 h-4 w-4" />
            导出 CSV
          </a>
        </div>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"一行一个 CDK，系统会保留原始大小写和字符"}
        />
        <p className="mt-2 text-xs leading-5 text-ink/55">每行一个 CDK。系统会保留原始大小写，不会自动转换大写或小写。</p>
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" disabled={loading || !text} onClick={importCdks}>
            {loading ? "导入中..." : "导入"}
          </Button>
          {message ? <p className="text-sm text-accent">{message}</p> : null}
          {error ? <p className="text-sm text-ember">{error}</p> : null}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-lg font-semibold">CDK 列表</h2>
        </div>
        {items.length === 0 ? (
          <div className="p-5">
            <EmptyState title="还没有 CDK" text="导入后会显示在这里。" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-paper text-ink/60">
                <tr>
                  <th className="p-3">CDK</th>
                  <th className="p-3">状态</th>
                  <th className="p-3">领取人</th>
                  <th className="p-3">领取时间</th>
                  <th className="p-3">IP / UA</th>
                  <th className="p-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="max-w-xs break-all p-3 font-mono">{item.code}</td>
                    <td className="p-3">
                      <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                    </td>
                    <td className="p-3">{item.claimer?.email ?? item.claim?.emailOrIdentifier ?? "-"}</td>
                    <td className="p-3">{item.claimedAt ? dateTimeLabel(item.claimedAt) : item.claim?.createdAt ? dateTimeLabel(item.claim.createdAt) : "-"}</td>
                    <td className="max-w-xs p-3 text-xs text-ink/60">
                      <div>{item.claim?.ip ?? "-"}</div>
                      <div className="truncate">{item.claim?.userAgent ?? ""}</div>
                    </td>
                    <td className="p-3 text-right">
                      {item.status === "AVAILABLE" ? (
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="secondary" disabled={Boolean(actionLoadingId)} onClick={() => disableCdk(item.id)}>
                            {actionLoadingId === item.id ? "处理中..." : "禁用"}
                          </Button>
                          <Button type="button" variant="danger" disabled={Boolean(actionLoadingId)} onClick={() => deleteCdk(item.id)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">删除</span>
                          </Button>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
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
