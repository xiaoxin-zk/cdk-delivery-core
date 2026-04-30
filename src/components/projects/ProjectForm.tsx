"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import { Turnstile } from "@/components/Turnstile";
import { CoverImage } from "@/components/projects/CoverImage";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { isValidImageUrl } from "@/lib/image-url";
import { CLAIM_MODE_DESCRIPTIONS, CLAIM_MODE_LABELS } from "@/lib/labels";

type PublicSettings = {
  turnstile: {
    enabled: boolean;
    siteKey: string;
    contexts: {
      createProject: boolean;
    };
  };
};

type ProjectInput = {
  id?: string;
  name?: string;
  description?: string;
  content?: string;
  instructions?: string;
  coverImage?: string | null;
  status?: string;
  visibility?: string;
  claimMode?: string;
  lotteryProbability?: number | null;
  requireLogin?: boolean;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  dailyLimit?: number | null;
  totalLimit?: number | null;
  perUserLimit?: number | null;
  illegalConfirmed?: boolean;
};

function dateInput(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

function numberValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function probabilityValue(formData: FormData) {
  const value = String(formData.get("lotteryProbability") ?? "");
  return value ? Number(value) : 100;
}

function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-normal leading-5 text-ink/55">{children}</p>;
}

export function ProjectForm({ initial, settings }: { initial?: ProjectInput; settings: PublicSettings }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");

  async function submit(formData: FormData) {
    setError("");
    const nextCoverImage = String(formData.get("coverImage") ?? "").trim();
    if (!isValidImageUrl(nextCoverImage)) {
      setError("请输入有效的图片 URL");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.get("name"),
        description: formData.get("description"),
        content: formData.get("content"),
        instructions: formData.get("instructions"),
        coverImage: nextCoverImage,
        status: formData.get("status"),
        visibility: formData.get("visibility"),
        claimMode: formData.get("claimMode"),
        lotteryProbability: probabilityValue(formData),
        requireLogin: formData.get("requireLogin") === "on",
        startAt: formData.get("startAt") || null,
        endAt: formData.get("endAt") || null,
        dailyLimit: numberValue(formData, "dailyLimit"),
        totalLimit: numberValue(formData, "totalLimit"),
        perUserLimit: numberValue(formData, "perUserLimit"),
        illegalConfirmed: formData.get("illegalConfirmed") === "on",
        turnstileToken
      };
      const result = await api<{ project: { id: string } }>(initial?.id ? `/api/projects/${initial.id}` : "/api/projects", {
        method: initial?.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      router.push(`/dashboard/projects/${result.project.id}/cdks`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={submit} className="grid gap-6">
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">基础信息</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Label>
            项目名称
            <Input name="name" defaultValue={initial?.name ?? ""} required maxLength={120} />
          </Label>
          <Label>
            封面图 URL
            <Input
              name="coverImage"
              value={coverImage}
              onChange={(event) => setCoverImage(event.target.value)}
              placeholder="https://picsum.photos/800/450"
            />
            <HelpText>可选。仅支持 http:// 或 https:// 开头的有效图片 URL，留空显示默认占位图。</HelpText>
            <CoverImage src={coverImage} alt={`${initial?.name ?? "项目"}封面预览`} className="mt-2" />
          </Label>
          <Label className="md:col-span-2">
            项目描述
            <Textarea name="description" defaultValue={initial?.description ?? ""} required maxLength={500} />
          </Label>
          <Label className="md:col-span-2">
            项目内容介绍
            <Textarea name="content" defaultValue={initial?.content ?? ""} required />
          </Label>
          <Label className="md:col-span-2">
            使用说明
            <Textarea name="instructions" defaultValue={initial?.instructions ?? ""} />
            <HelpText>领取成功后会和 CDK 一起展示给用户，用于说明兑换入口、有效期或使用限制。</HelpText>
          </Label>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">领取规则</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Label>
            项目状态
            <Select name="status" defaultValue={initial?.status ?? "DRAFT"}>
              <option value="DRAFT">草稿</option>
              <option value="PUBLIC">公开领取</option>
              <option value="PAUSED">暂停领取</option>
              <option value="ENDED">结束项目</option>
            </Select>
            <HelpText>只有“公开领取”且审核通过的项目才允许用户领取 CDK。</HelpText>
          </Label>
          <Label>
            公开展示
            <Select name="visibility" defaultValue={initial?.visibility ?? "PUBLIC"}>
              <option value="PUBLIC">公开展示</option>
              <option value="PRIVATE">私有项目</option>
            </Select>
            <HelpText>开启后，该项目会出现在公开项目列表中。关闭后，只有拥有链接或管理权限的用户可以查看。</HelpText>
          </Label>
          <Label>
            领取模式
            <Select name="claimMode" defaultValue={initial?.claimMode ?? "LOTTERY"}>
              <option value="LOTTERY">{CLAIM_MODE_LABELS.LOTTERY}</option>
              <option value="ONCE">{CLAIM_MODE_LABELS.ONCE}</option>
              <option value="REPEAT">{CLAIM_MODE_LABELS.REPEAT}</option>
            </Select>
            <HelpText>
              {CLAIM_MODE_DESCRIPTIONS.LOTTERY} {CLAIM_MODE_DESCRIPTIONS.ONCE} {CLAIM_MODE_DESCRIPTIONS.REPEAT}
            </HelpText>
            {initial?.id ? (
              <HelpText>
                切换领取模式不会删除历史领取或抽奖记录。系统会按新模式重新判断用户是否可继续参与。
                从抽奖模式切换到每人一次时，历史未中奖记录不会默认视为已领取；历史中奖并获得 CDK 的用户会被视为已领取。
                从每人一次切换到抽奖模式时，历史领取记录可能会影响用户是否还能参与抽奖，具体取决于抽奖规则设置。
              </HelpText>
            ) : null}
          </Label>
          <Label>
            抽奖中奖概率（%）
            <Input
              name="lotteryProbability"
              type="number"
              min={1}
              max={100}
              defaultValue={initial?.lotteryProbability ?? 100}
            />
            <HelpText>仅抽奖模式生效。100 表示每次命中，1 表示约 1% 概率中奖。</HelpText>
          </Label>
          <Label>
            开始时间
            <Input name="startAt" type="datetime-local" defaultValue={dateInput(initial?.startAt)} />
            <HelpText>留空表示立即可领取。</HelpText>
          </Label>
          <Label>
            结束时间
            <Input name="endAt" type="datetime-local" defaultValue={dateInput(initial?.endAt)} />
            <HelpText>留空表示不限制结束时间。</HelpText>
          </Label>
          <Label>
            每日领取限制
            <Input name="dailyLimit" type="number" min={1} defaultValue={initial?.dailyLimit ?? ""} />
            <HelpText>限制该项目每天最多可以被领取多少次，留空表示不限制。</HelpText>
          </Label>
          <Label>
            总领取限制
            <Input name="totalLimit" type="number" min={1} defaultValue={initial?.totalLimit ?? ""} />
            <HelpText>限制该项目累计最多可以被领取多少次，留空表示不限制。</HelpText>
          </Label>
          <Label>
            单用户领取限制
            <Input name="perUserLimit" type="number" min={1} defaultValue={initial?.perUserLimit ?? ""} />
            <HelpText>限制每个用户最多可以领取多少次，留空表示不限制。</HelpText>
          </Label>
          <label className="flex min-h-11 items-start gap-2 rounded border border-line bg-paper p-3 text-sm">
            <input name="requireLogin" type="checkbox" defaultChecked={initial?.requireLogin ?? true} className="mt-1" />
            <span>
              需要登录后领取
              <span className="mt-1 block text-xs leading-5 text-ink/55">开启后，用户必须登录账号才能领取 CDK。</span>
            </span>
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">安全审核</h2>
        <label className="flex items-start gap-3 text-sm leading-6">
          <input name="illegalConfirmed" type="checkbox" defaultChecked={initial?.illegalConfirmed ?? false} required className="mt-1" />
          <span>
            我确认该项目不涉及诈骗、钓鱼、恶意软件、盗版、违法交易、攻击工具或其他违法违规内容。
            <span className="mt-1 block text-xs leading-5 text-ink/55">
              创建项目前必须确认项目不涉及违法违规内容。命中敏感词的项目可能进入待审核或被禁止发布。
            </span>
          </span>
        </label>
      </Card>

      <Turnstile
        enabled={settings.turnstile.enabled && settings.turnstile.contexts.createProject}
        siteKey={settings.turnstile.siteKey}
        onToken={setTurnstileToken}
      />
      {error ? <p className="text-sm text-ember">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          返回
        </Button>
        <Button disabled={loading}>{loading ? "保存中..." : "保存项目"}</Button>
      </div>
    </form>
  );
}
