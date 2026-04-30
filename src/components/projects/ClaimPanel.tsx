"use client";

import { Copy, Gift } from "lucide-react";
import React, { FormEvent, useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/components/api";
import { Turnstile } from "@/components/Turnstile";
import { Button, Card, Input, Label } from "@/components/ui";
import { claimModeDescription, claimModeLabel, dateTimeLabel } from "@/lib/labels";

type PublicSettings = {
  turnstile: {
    enabled: boolean;
    siteKey: string;
    contexts: {
      claim: boolean;
    };
  };
};

export type ClaimResponse = {
  success?: boolean;
  won?: boolean;
  message?: string;
  participationConsumed?: boolean;
  canRetry?: boolean;
  claim?: {
    id: string;
    claimedAt: string;
  };
  cdk?: {
    id: string;
    code: string;
  };
};

export type ClaimDisplayResult = {
  code: string;
  claimedAt: string;
};

type ClaimResultParseResult = {
  result: ClaimDisplayResult | null;
  error: string;
};

type ClipboardWriter = {
  writeText: (text: string) => Promise<void>;
};

export const MISSING_CDK_ERROR = "领取成功，但未返回 CDK，请联系管理员。";
export const COPY_SUCCESS_MESSAGE = "CDK 已复制";

const CLAIM_ERROR_TEXT: Record<string, { message: string; buttonLabel: string }> = {
  ALREADY_PARTICIPATED: {
    message: "你已经参与过该项目抽奖，不能重复参与。",
    buttonLabel: "已参与"
  },
  ALREADY_CLAIMED: {
    message: "你已经领取过该项目的 CDK，不能重复领取。",
    buttonLabel: "已领取"
  },
  USER_LIMIT_REACHED: {
    message: "你的领取次数已达上限。",
    buttonLabel: "次数已达上限"
  }
};

function getLocalLimitState(claimMode: string, perUserLimit: number | null | undefined, nextUsageCount: number) {
  const normalizedLimit =
    typeof perUserLimit === "number" && Number.isInteger(perUserLimit) && perUserLimit > 0 ? perUserLimit : null;
  if (claimMode === "ONCE") return CLAIM_ERROR_TEXT.ALREADY_CLAIMED;
  if (!normalizedLimit || nextUsageCount < normalizedLimit) return null;
  if (claimMode === "LOTTERY" && normalizedLimit === 1) return CLAIM_ERROR_TEXT.ALREADY_PARTICIPATED;
  return CLAIM_ERROR_TEXT.USER_LIMIT_REACHED;
}

export function claimResultFromResponse(data: ClaimResponse): ClaimResultParseResult {
  if (data.won !== true) return { result: null, error: "" };
  const cdkCode = data.cdk?.code;
  const claimedAt = data.claim?.claimedAt;
  if (!cdkCode || !claimedAt) return { result: null, error: MISSING_CDK_ERROR };
  return { result: { code: cdkCode, claimedAt }, error: "" };
}

function storedClaimResultKey(projectId: string) {
  return `claim-result:${projectId}`;
}

function toClaimDisplayResult(value: unknown): ClaimDisplayResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Partial<ClaimDisplayResult>;
  return typeof result.code === "string" && typeof result.claimedAt === "string"
    ? { code: result.code, claimedAt: result.claimedAt }
    : null;
}

function readStoredClaimResult(projectId: string) {
  if (typeof window === "undefined") return null;
  try {
    return toClaimDisplayResult(JSON.parse(window.sessionStorage.getItem(storedClaimResultKey(projectId)) ?? "null"));
  } catch {
    return null;
  }
}

function writeStoredClaimResult(projectId: string, result: ClaimDisplayResult) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storedClaimResultKey(projectId), JSON.stringify(result));
  } catch {
    // Keeping the just-claimed CDK visible in state is more important than best-effort session restore.
  }
}

export async function copyCdkToClipboard(code: string, clipboard?: ClipboardWriter) {
  const writer = clipboard ?? globalThis.navigator?.clipboard;
  if (!writer) throw new Error("CLIPBOARD_UNAVAILABLE");
  await writer.writeText(code);
  return COPY_SUCCESS_MESSAGE;
}

export function ClaimResultCard({
  claimMode,
  result,
  instructions,
  copyMessage,
  onCopy
}: {
  claimMode: string;
  result: ClaimDisplayResult;
  instructions: string;
  copyMessage: string;
  onCopy: (code: string) => void;
}) {
  return (
    <div className="rounded-lg border border-accent bg-emerald-50 p-4">
      <p className="text-sm font-medium text-emerald-800">{claimMode === "LOTTERY" ? "恭喜中奖！" : "领取成功"}</p>
      <div className="mt-3 flex items-center gap-2 rounded bg-white p-3 font-mono text-sm">
        <span className="min-w-0 flex-1 break-all">{result.code}</span>
        <Button type="button" variant="secondary" onClick={() => onCopy(result.code)}>
          <Copy className="mr-2 h-4 w-4" />
          复制
        </Button>
      </div>
      {copyMessage ? <p className="mt-2 text-sm text-emerald-800">{copyMessage}</p> : null}
      <div className="mt-3 grid gap-2 text-sm leading-6 text-emerald-900">
        <p>领取时间：{dateTimeLabel(result.claimedAt)}</p>
        <p className="whitespace-pre-wrap">使用说明：{instructions || "暂无说明"}</p>
      </div>
    </div>
  );
}

export function ClaimPanel({
  projectId,
  requireLogin,
  isLoggedIn,
  settings,
  claimMode,
  instructions,
  disabledReason,
  availableCount,
  claimedCount,
  userClaims,
  userAttempts,
  perUserLimit,
  initialResult
}: {
  projectId: string;
  requireLogin: boolean;
  isLoggedIn: boolean;
  settings: PublicSettings;
  claimMode: string;
  instructions: string;
  disabledReason?: string;
  availableCount: number;
  claimedCount: number;
  userClaims: number;
  userAttempts?: number;
  perUserLimit?: number | null;
  initialResult?: ClaimDisplayResult | null;
}) {
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ClaimDisplayResult | null>(initialResult ?? null);
  const [copyMessage, setCopyMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [localAvailableCount, setLocalAvailableCount] = useState(availableCount);
  const [localClaimedCount, setLocalClaimedCount] = useState(claimedCount);
  const [localUserAttempts, setLocalUserAttempts] = useState(claimMode === "LOTTERY" ? userAttempts ?? userClaims : userClaims);
  const [terminalReason, setTerminalReason] = useState(initialResult && disabledReason ? disabledReason : "");
  const [terminalButtonLabel, setTerminalButtonLabel] = useState(initialResult && disabledReason ? "当前不可领取" : "");

  useEffect(() => {
    if (result) return;
    const storedResult = readStoredClaimResult(projectId);
    if (storedResult) setResult(storedResult);
  }, [projectId, result]);

  useEffect(() => {
    if (result && disabledReason && !terminalReason) {
      setTerminalReason(disabledReason);
      setTerminalButtonLabel("当前不可领取");
    }
  }, [disabledReason, result, terminalReason]);

  async function submit(formData: FormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    setErrorCode("");
    setMessage("");
    setCopyMessage("");
    try {
      const data = await api<ClaimResponse>(`/api/projects/${projectId}/claim`, {
        method: "POST",
        body: JSON.stringify({
          emailOrIdentifier: formData.get("emailOrIdentifier") || undefined,
          turnstileToken
        })
      });

      if (data.won === false) {
        const nextAttempts = localUserAttempts + 1;
        const text = data.message ?? (data.canRetry === false ? "很遗憾，本次未中奖。" : "很遗憾，本次未中奖，你可以再次尝试。");
        const limitState = data.canRetry === false ? getLocalLimitState(claimMode, perUserLimit, nextAttempts) : null;
        setLocalUserAttempts(nextAttempts);
        setMessage(text);
        if (limitState) {
          setTerminalReason(limitState.message);
          setTerminalButtonLabel(limitState.buttonLabel);
        }
        return;
      }

      const parsedResult = claimResultFromResponse(data);
      if (parsedResult.error) {
        console.error("领取成功响应缺少 CDK", data);
        setError(parsedResult.error);
        return;
      }
      if (!parsedResult.result) {
        setError(data.message ?? "领取结果异常，请稍后重试");
        return;
      }

      const nextAvailableCount = Math.max(0, localAvailableCount - 1);
      const nextAttempts = localUserAttempts + 1;
      const successText = claimMode === "LOTTERY" ? "恭喜中奖！" : "领取成功！";
      setResult(parsedResult.result);
      writeStoredClaimResult(projectId, parsedResult.result);
      setMessage(data.message ?? successText);
      setLocalAvailableCount(nextAvailableCount);
      setLocalClaimedCount((value) => value + 1);
      setLocalUserAttempts(nextAttempts);
      const limitState = getLocalLimitState(claimMode, perUserLimit, nextAttempts);
      if (limitState) {
        setTerminalReason(limitState.message);
        setTerminalButtonLabel(limitState.buttonLabel);
      } else if (data.canRetry === false || claimMode === "ONCE") {
        const terminalState = claimMode === "LOTTERY" ? CLAIM_ERROR_TEXT.ALREADY_PARTICIPATED : CLAIM_ERROR_TEXT.ALREADY_CLAIMED;
        setTerminalReason(terminalState.message);
        setTerminalButtonLabel(terminalState.buttonLabel);
      } else if (nextAvailableCount <= 0) {
        setTerminalReason("该项目的 CDK 已全部发放完毕。");
        setTerminalButtonLabel("已领完");
      }
    } catch (err) {
      let message = err instanceof Error ? err.message : "领取失败，请稍后重试";
      if (err instanceof ApiClientError && CLAIM_ERROR_TEXT[err.code]) {
        message = CLAIM_ERROR_TEXT[err.code].message;
      }
      setError(message);
      setErrorCode(err instanceof ApiClientError ? err.code : "");
      if (err instanceof ApiClientError) {
        switch (err.code) {
          case "ALREADY_PARTICIPATED":
            setTerminalReason(CLAIM_ERROR_TEXT.ALREADY_PARTICIPATED.message);
            setTerminalButtonLabel(CLAIM_ERROR_TEXT.ALREADY_PARTICIPATED.buttonLabel);
            break;
          case "ALREADY_CLAIMED":
            setTerminalReason(CLAIM_ERROR_TEXT.ALREADY_CLAIMED.message);
            setTerminalButtonLabel(CLAIM_ERROR_TEXT.ALREADY_CLAIMED.buttonLabel);
            break;
          case "ALREADY_WON":
            setTerminalReason(message || "你已经中过奖，不能重复参与。");
            setTerminalButtonLabel("已中奖");
            break;
          case "NO_CDK_AVAILABLE":
            setTerminalReason(message || "该项目的 CDK 已全部发放完毕。");
            setTerminalButtonLabel("已领完");
            break;
          case "USER_LIMIT_REACHED":
            setTerminalReason(CLAIM_ERROR_TEXT.USER_LIMIT_REACHED.message);
            setTerminalButtonLabel(CLAIM_ERROR_TEXT.USER_LIMIT_REACHED.buttonLabel);
            break;
          case "TOTAL_LIMIT_REACHED":
          case "DAILY_LIMIT_REACHED":
            setTerminalReason(message);
            setTerminalButtonLabel("次数已达上限");
            break;
          case "PROJECT_PRIVATE":
          case "PROJECT_NOT_APPROVED":
          case "PROJECT_ENDED":
          case "PROJECT_NOT_CLAIMABLE":
          case "PROJECT_NOT_STARTED":
          case "LOGIN_REQUIRED":
            setTerminalReason(message);
            setTerminalButtonLabel("当前不可领取");
            break;
          default:
            break;
        }
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function copyCdk(code: string) {
    try {
      setCopyMessage(await copyCdkToClipboard(code));
    } catch {
      setError("复制失败，请手动复制 CDK");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || terminalReason) return;
    void submit(new FormData(event.currentTarget));
  }

  if (disabledReason && !result) {
    return (
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">领取 CDK</h2>
        </div>
        <p className="rounded border border-line bg-paper p-3 text-sm text-ink/75">{disabledReason}</p>
        {requireLogin && !isLoggedIn ? (
          <a className="mt-4 inline-flex min-h-10 items-center rounded bg-ink px-4 py-2 text-sm font-medium text-white" href="/login">
            去登录
          </a>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Gift className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">领取 CDK</h2>
      </div>
      <div className="mb-4 rounded border border-line bg-paper p-3 text-sm leading-6 text-ink/70">
        <p className="font-medium text-ink">{claimModeLabel(claimMode)}</p>
        <p>{claimModeDescription(claimMode)}</p>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-line bg-paper p-3">
          <p className="text-ink/55">剩余数量</p>
          <p className="mt-1 text-xl font-semibold">{localAvailableCount}</p>
        </div>
        <div className="rounded border border-line bg-paper p-3">
          <p className="text-ink/55">已领取</p>
          <p className="mt-1 text-xl font-semibold">{localClaimedCount}</p>
        </div>
      </div>
      {message ? <p className="mb-4 rounded border border-line bg-paper p-3 text-sm text-ink/75">{message}</p> : null}
      {result ? (
        <ClaimResultCard claimMode={claimMode} result={result} instructions={instructions} copyMessage={copyMessage} onCopy={copyCdk} />
      ) : null}
      {terminalReason ? (
        <p className="mt-4 rounded border border-line bg-paper p-3 text-sm text-ink/75">{terminalReason}</p>
      ) : null}
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
        {!isLoggedIn ? (
          <Label>
            邮箱或领取标识
            <Input name="emailOrIdentifier" required placeholder="用于限制重复领取" />
          </Label>
        ) : null}
        <Turnstile
          enabled={settings.turnstile.enabled && settings.turnstile.contexts.claim}
          siteKey={settings.turnstile.siteKey}
          onToken={setTurnstileToken}
        />
        <Button type="submit" disabled={loading || Boolean(terminalReason)}>
          {loading ? "领取中..." : terminalReason ? terminalButtonLabel : result ? "继续领取" : claimMode === "LOTTERY" ? "立即抽奖" : "立即领取"}
        </Button>
        {error ? (
          <div className="rounded border border-ember/30 bg-red-50 p-3 text-sm text-ember">
            <p>{error}</p>
            {errorCode ? <p className="mt-1 text-xs text-ember/75">错误代码：{errorCode}</p> : null}
          </div>
        ) : null}
      </form>
    </Card>
  );
}
