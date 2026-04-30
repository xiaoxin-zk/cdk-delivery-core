"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";

type Word = { id: string; word: string; enabled: boolean };
type PageData = {
  items: Word[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function SensitiveWordsPanel() {
  const [words, setWords] = useState<Word[]>([]);
  const [word, setWord] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load(nextPage = page) {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: "20"
    });
    if (search.trim()) params.set("search", search.trim());
    const data = await api<PageData>(`/api/admin/sensitive-words?${params.toString()}`);
    setWords(data.items);
    setPage(data.page);
    setPageCount(Math.max(1, data.pageCount));
  }

  useEffect(() => {
    load(1).catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function add() {
    if (!word.trim()) return;
    await saveWords({ word: word.trim() });
    setWord("");
  }

  async function importBulk() {
    if (!bulkText.trim()) return;
    await saveWords({ text: bulkText });
    setBulkText("");
  }

  async function saveWords(payload: { word?: string; text?: string }) {
    setError("");
    setMessage("");
    try {
      const result = await api<{ imported: number }>("/api/admin/sensitive-words", {
        method: "POST",
        body: JSON.stringify({ ...payload, enabled: true })
      });
      setMessage(`已新增 ${result.imported} 个敏感词，重复项已自动跳过`);
      await load(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function toggle(item: Word) {
    await api(`/api/admin/sensitive-words/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !item.enabled })
    });
    await load();
  }

  async function edit(item: Word) {
    const next = window.prompt("编辑敏感词", item.word);
    if (next === null || !next.trim()) return;
    await api(`/api/admin/sensitive-words/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ word: next.trim() })
    });
    await load();
  }

  async function remove(item: Word) {
    if (!window.confirm("确认删除该敏感词？")) return;
    await api(`/api/admin/sensitive-words/${item.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold">敏感词列表</h2>
      <div className="mb-4 grid gap-3">
        <div className="flex gap-2">
          <Input value={word} onChange={(event) => setWord(event.target.value)} placeholder="新增单个敏感词" />
          <Button type="button" onClick={add}>
            添加
          </Button>
        </div>
        <div className="grid gap-2">
          <Textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder="批量导入，支持换行、逗号、中文逗号自动拆分" />
          <Button className="w-fit" type="button" variant="secondary" onClick={importBulk}>
            批量导入
          </Button>
        </div>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索敏感词" />
      </div>
      {message ? <p className="mb-3 text-sm text-accent">{message}</p> : null}
      {error ? <p className="text-sm text-ember">{error}</p> : null}
      <div className="grid gap-2">
        {words.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded border border-line p-3">
            <div className="flex items-center gap-2">
              <span>{item.word}</span>
              <Badge tone={item.enabled ? "green" : "neutral"}>{item.enabled ? "启用" : "停用"}</Badge>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => edit(item)}>
                编辑
              </Button>
              <Button type="button" variant="secondary" onClick={() => toggle(item)}>
                {item.enabled ? "停用" : "启用"}
              </Button>
              <Button type="button" variant="danger" onClick={() => remove(item)}>
                删除
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => load(page - 1)}>
          上一页
        </Button>
        <span>
          第 {page} / {pageCount} 页
        </span>
        <Button type="button" variant="secondary" disabled={page >= pageCount} onClick={() => load(page + 1)}>
          下一页
        </Button>
      </div>
    </Card>
  );
}
