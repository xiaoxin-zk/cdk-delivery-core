import { SettingsPanel } from "@/components/admin/SettingsPanel";

export default function AdminEmailPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">邮件设置</h1>
        <p className="mt-2 text-ink/60">用于发送注册验证、忘记密码、系统通知等邮件。请确保 SMTP 地址、端口、账号和密码正确。</p>
      </div>
      <SettingsPanel
        title="SMTP"
        fields={[
          { key: "smtp.host", label: "SMTP 主机", description: "邮件服务商提供的 SMTP 地址，例如 smtp.qq.com。" },
          { key: "smtp.port", label: "SMTP 端口", type: "number", description: "常见端口为 465、587 或 25，请以邮件服务商说明为准。" },
          { key: "smtp.username", label: "SMTP 用户名", description: "通常是发件邮箱或邮件服务商提供的账号。" },
          { key: "smtp.password", label: "SMTP 密码", type: "password", description: "通常是授权码或应用专用密码，保存后后台会脱敏显示。" },
          { key: "smtp.fromName", label: "发件人名称" },
          { key: "smtp.fromEmail", label: "发件邮箱" },
          { key: "smtp.secure", label: "启用 TLS / SSL", type: "boolean", description: "如果使用 465 端口通常需要开启，587 通常不需要开启但会使用 STARTTLS。" }
        ]}
      />
    </div>
  );
}
