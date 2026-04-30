"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type User = {
  id: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
};

export function AdminUserForm({ user, currentAdminId }: { user: User; currentAdminId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const isSelf = user.id === currentAdminId;
  const isDeleted = user.status === "DELETED";

  async function submit(formData: FormData) {
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: formData.get("role"),
          status: formData.get("status"),
          emailVerified: formData.get("emailVerified") === "on",
          password: formData.get("password") || undefined
        })
      });
      setMessage("用户已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function deleteUser() {
    if (isSelf) {
      setError("不能删除当前登录账号");
      return;
    }
    if (!window.confirm(`确认软删除用户 ${user.email}？删除后该账号将无法登录。`)) return;
    setError("");
    setMessage("");
    setDeleting(true);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      router.push("/admin/users");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold">编辑用户</h2>
      <form action={submit} className="grid gap-4">
        <Label>
          邮箱
          <Input value={user.email} disabled />
        </Label>
        <Label>
          角色
          <Select name="role" defaultValue={user.role}>
            <option value="USER">普通用户</option>
            <option value="ADMIN">管理员</option>
          </Select>
        </Label>
        <Label>
          状态
          <Select name="status" defaultValue={user.status}>
            <option value="ACTIVE">已启用</option>
            <option value="DISABLED">已禁用</option>
            <option value="DELETED">已软删除</option>
          </Select>
        </Label>
        <label className="flex items-center gap-2 text-sm">
          <input name="emailVerified" type="checkbox" defaultChecked={user.emailVerified} />
          邮箱已验证
        </label>
        <Label>
          重置密码
          <Input name="password" type="password" placeholder="留空则不修改" />
        </Label>
        <div className="flex flex-wrap gap-3">
          <Button className="w-fit">保存用户</Button>
          <Button
            type="button"
            variant="danger"
            disabled={deleting || isSelf || isDeleted}
            onClick={deleteUser}
            title={isSelf ? "不能删除当前登录账号" : undefined}
          >
            {deleting ? "删除中..." : isDeleted ? "已删除" : "删除用户"}
          </Button>
        </div>
        {isSelf ? <p className="text-xs text-ink/55">当前登录账号不能删除，避免失去后台访问权限。</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}
        {error ? <p className="text-sm text-ember">{error}</p> : null}
      </form>
    </Card>
  );
}
