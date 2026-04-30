"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/components/api";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";

type Field = {
  key: string;
  label: string;
  description?: string;
  type?: "text" | "password" | "number" | "boolean" | "textarea" | "select" | "tags";
  options?: Array<{ value: string; label: string }>;
  validate?: "domain";
};

const CONFIGURED_LABEL = "已配置";

export function SettingsPanel({ title, fields }: { title: string; fields: Field[] }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ settings: Record<string, string> }>("/api/admin/settings")
      .then((data) => setSettings(data.settings))
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, []);

  const turnstileWarning = useMemo(() => {
    const hasTurnstileFields = fields.some((field) => field.key.startsWith("turnstile."));
    if (!hasTurnstileFields || settings["turnstile.enabled"] !== "true") return "";
    if (settings["turnstile.siteKey"] && settings["turnstile.secretKey"]) return "";
    return "已开启 Turnstile，但 Site Key 或 Secret Key 未配置完整。";
  }, [fields, settings]);

  async function submit(formData: FormData) {
    setError("");
    setMessage("");
    const next: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === "boolean") {
        next[field.key] = formData.get(field.key) === "on" ? "true" : "false";
      } else if (field.type === "tags") {
        next[field.key] = settings[field.key] ?? "[]";
      } else {
        next[field.key] = String(formData.get(field.key) ?? "");
      }
    }
    try {
      const result = await api<{ settings: Record<string, string> }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings: next })
      });
      setSettings(result.settings);
      setMessage("设置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {turnstileWarning ? <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{turnstileWarning}</p> : null}
      <form action={submit} className="grid gap-4">
        {fields.map((field) => (
          <SettingField
            key={field.key}
            field={field}
            value={settings[field.key] ?? ""}
            onChange={(value) => setSettings((current) => ({ ...current, [field.key]: value }))}
          />
        ))}
        <Button className="w-fit">保存设置</Button>
        {message ? <p className="text-sm text-accent">{message}</p> : null}
        {error ? <p className="text-sm text-ember">{error}</p> : null}
      </form>
    </Card>
  );
}

function SettingField({
  field,
  value,
  onChange
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-start gap-3 rounded border border-line bg-paper p-3 text-sm">
        <input
          name={field.key}
          type="checkbox"
          checked={value === "true"}
          onChange={(event) => onChange(event.target.checked ? "true" : "false")}
          className="mt-1"
        />
        <span>
          <span className="font-medium">{field.label}</span>
          {field.description ? <span className="mt-1 block text-xs leading-5 text-ink/55">{field.description}</span> : null}
        </span>
      </label>
    );
  }
  if (field.type === "tags") {
    return <TagsField field={field} value={value} onChange={onChange} />;
  }
  if (field.type === "textarea") {
    return (
      <Label>
        {field.label}
        <Textarea name={field.key} value={value} onChange={(event) => onChange(event.target.value)} />
        {field.description ? <span className="text-xs font-normal leading-5 text-ink/55">{field.description}</span> : null}
      </Label>
    );
  }
  if (field.type === "select") {
    return (
      <Label>
        {field.label}
        <Select name={field.key} value={value} onChange={(event) => onChange(event.target.value)}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {field.description ? <span className="text-xs font-normal leading-5 text-ink/55">{field.description}</span> : null}
      </Label>
    );
  }

  const isPassword = field.type === "password";
  const inputValue = isPassword && value === CONFIGURED_LABEL ? "" : value;
  return (
    <Label>
      {field.label}
      <Input
        name={field.key}
        type={isPassword ? "password" : field.type === "number" ? "number" : "text"}
        value={inputValue}
        placeholder={isPassword && value === CONFIGURED_LABEL ? "已配置，留空表示保持原值" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {field.description ? <span className="text-xs font-normal leading-5 text-ink/55">{field.description}</span> : null}
    </Label>
  );
}

function TagsField({ field, value, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const tags = parseTags(value);

  function commit(raw: string) {
    const candidates = splitTags(raw);
    if (candidates.length === 0) return;
    const next = [...tags];
    for (const candidate of candidates) {
      const normalized = normalizeTag(candidate, field);
      if (!normalized.ok) {
        setError(normalized.error);
        continue;
      }
      if (!next.includes(normalized.value)) next.push(normalized.value);
    }
    onChange(JSON.stringify(next));
    setDraft("");
  }

  function remove(tag: string) {
    onChange(JSON.stringify(tags.filter((item) => item !== tag)));
  }

  return (
    <div className="grid gap-2 text-sm">
      <span className="font-medium">{field.label}</span>
      <div className="flex flex-wrap gap-2 rounded border border-line bg-white p-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-2 rounded bg-paper px-2 py-1 text-xs">
            {tag}
            <button type="button" className="text-ember" onClick={() => remove(tag)}>
              删除
            </button>
          </span>
        ))}
        <input
          className="min-h-8 min-w-48 flex-1 bg-transparent px-1 outline-none"
          value={draft}
          placeholder="输入后按回车添加"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            }
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (splitTags(text).length > 1) {
              event.preventDefault();
              commit(text);
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={() => commit(draft)}>
          添加
        </Button>
        {tags.length > 0 ? (
          <Button type="button" variant="ghost" onClick={() => onChange("[]")}>
            清空全部
          </Button>
        ) : null}
      </div>
      {field.description ? <span className="text-xs font-normal leading-5 text-ink/55">{field.description}</span> : null}
      {error ? <span className="text-xs text-ember">{error}</span> : null}
    </div>
  );
}

function parseTags(value: string) {
  if (!value) return [];
  if (value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      // Fall back to delimiter parsing for legacy values.
    }
  }
  return splitTags(value);
}

function splitTags(value: string) {
  return value
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTag(value: string, field: Field): { ok: true; value: string } | { ok: false; error: string } {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return { ok: false, error: "不能添加空内容" };
  if (field.validate === "domain") {
    if (normalized.startsWith("@")) return { ok: false, error: "邮箱后缀不要包含 @" };
    if (/^https?:\/\//i.test(normalized)) return { ok: false, error: "邮箱后缀不要包含 http:// 或 https://" };
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(normalized)) {
      return { ok: false, error: "邮箱后缀格式不正确，例如 qq.com、gmail.com" };
    }
  }
  return { ok: true, value: normalized };
}
