"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/components/api";
import { Turnstile } from "@/components/Turnstile";
import { Button, Card, Input, Label } from "@/components/ui";

type PublicSettings = {
  registrationEnabled: boolean;
  forgotPasswordEnabled: boolean;
  turnstile: {
    enabled: boolean;
    siteKey: string;
    contexts: {
      register: boolean;
      login: boolean;
      forgotPassword: boolean;
      claim: boolean;
      createProject: boolean;
    };
  };
};

function useMessage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return { message, error, setMessage, setError };
}

export function LoginForm({ settings }: { settings: PublicSettings }) {
  const router = useRouter();
  const { message, error, setMessage, setError } = useMessage();
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          remember: formData.get("remember") === "on",
          turnstileToken
        })
      });
      setMessage("登录成功");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="登录">
      <form action={submit} className="grid gap-4">
        <Label>
          邮箱
          <Input name="email" type="email" required autoComplete="email" />
        </Label>
        <Label>
          密码
          <Input name="password" type="password" required autoComplete="current-password" />
        </Label>
        <label className="flex items-center gap-2 text-sm">
          <input name="remember" type="checkbox" />
          记住登录状态
        </label>
        <Turnstile
          enabled={settings.turnstile.enabled && settings.turnstile.contexts.login}
          siteKey={settings.turnstile.siteKey}
          onToken={setTurnstileToken}
        />
        <Button disabled={loading}>{loading ? "登录中..." : "登录"}</Button>
        {settings.forgotPasswordEnabled ? <Link className="text-sm text-accent" href="/forgot-password">忘记密码？</Link> : null}
        <Message message={message} error={error} />
      </form>
    </AuthCard>
  );
}

export function RegisterForm({ settings }: { settings: PublicSettings }) {
  const router = useRouter();
  const { message, error, setMessage, setError } = useMessage();
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          turnstileToken
        })
      });
      setMessage("注册成功，请按页面提示登录或验证邮箱。");
      window.setTimeout(() => router.push("/login"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  if (!settings.registrationEnabled) {
    return (
      <AuthCard title="注册功能已关闭">
        <p className="text-sm text-ink/70">当前站点已关闭注册，新用户暂时无法创建账号。已有用户仍可正常登录。</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="注册">
      <form action={submit} className="grid gap-4">
        <Label>
          邮箱
          <Input name="email" type="email" required autoComplete="email" />
        </Label>
        <Label>
          密码
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Label>
        <Turnstile
          enabled={settings.turnstile.enabled && settings.turnstile.contexts.register}
          siteKey={settings.turnstile.siteKey}
          onToken={setTurnstileToken}
        />
        <Button disabled={loading}>{loading ? "注册中..." : "创建账号"}</Button>
        <Message message={message} error={error} />
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordForm({ settings }: { settings: PublicSettings }) {
  const { message, error, setMessage, setError } = useMessage();
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: formData.get("email"), turnstileToken })
      });
      setMessage("如果邮箱存在，系统会发送重置链接。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setLoading(false);
    }
  }

  if (!settings.forgotPasswordEnabled) {
    return (
      <AuthCard title="找回密码功能已关闭">
        <p className="text-sm text-ink/70">管理员当前关闭了找回密码功能，请联系站点管理员处理。</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="找回密码">
      <form action={submit} className="grid gap-4">
        <Label>
          邮箱
          <Input name="email" type="email" required />
        </Label>
        <Turnstile
          enabled={settings.turnstile.enabled && settings.turnstile.contexts.forgotPassword}
          siteKey={settings.turnstile.siteKey}
          onToken={setTurnstileToken}
        />
        <Button disabled={loading}>{loading ? "发送中..." : "发送重置链接"}</Button>
        <Message message={message} error={error} />
      </form>
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const { message, error, setMessage, setError } = useMessage();
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: searchParams.get("token") ?? "",
          password: formData.get("password")
        })
      });
      setMessage("密码已更新，请重新登录。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="重置密码">
      <form action={submit} className="grid gap-4">
        <Label>
          新密码
          <Input name="password" type="password" required minLength={8} />
        </Label>
        <Button disabled={loading}>{loading ? "提交中..." : "更新密码"}</Button>
        <Message message={message} error={error} />
      </form>
    </AuthCard>
  );
}

function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-140px)] max-w-md place-items-center px-4 py-12">
      <Card className="w-full p-6">
        <h1 className="mb-5 text-2xl font-semibold">{title}</h1>
        {children}
      </Card>
    </main>
  );
}

function Message({ message, error }: { message: string; error: string }) {
  if (!message && !error) return null;
  return <p className={error ? "text-sm text-ember" : "text-sm text-accent"}>{error || message}</p>;
}
