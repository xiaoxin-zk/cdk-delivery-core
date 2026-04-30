import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/dashboard/ChangePasswordForm";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { statusLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">账号设置</h1>
        <p className="mt-2 text-ink/60">查看账号信息并维护登录密码。</p>
      </div>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">账号信息</h2>
        <div className="grid gap-2 text-sm">
          <p>邮箱：{user.email}</p>
          <p>角色：{statusLabel(user.role)}</p>
          <p>邮箱验证：{user.emailVerified ? "已验证" : "未验证"}</p>
        </div>
      </Card>
      <ChangePasswordForm />
    </div>
  );
}
