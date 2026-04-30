"use client";

import { useState } from "react";
import { api } from "@/components/api";
import { Button, Card, Input, Label } from "@/components/ui";

export function ChangePasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await api("/api/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: formData.get("currentPassword"),
          newPassword: formData.get("newPassword")
        })
      });
      setMessage("密码已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold">修改密码</h2>
      <form action={submit} className="grid max-w-md gap-4">
        <Label>
          当前密码
          <Input name="currentPassword" type="password" required />
        </Label>
        <Label>
          新密码
          <Input name="newPassword" type="password" minLength={8} required />
        </Label>
        <Button disabled={loading}>{loading ? "更新中..." : "更新密码"}</Button>
        {message ? <p className="text-sm text-accent">{message}</p> : null}
        {error ? <p className="text-sm text-ember">{error}</p> : null}
      </form>
    </Card>
  );
}
