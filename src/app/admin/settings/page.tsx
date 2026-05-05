import { SettingsPanel } from "@/components/admin/SettingsPanel";

export default function AdminSettingsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">系统设置</h1>
        <p className="mt-2 text-ink/60">维护站点展示、注册策略和领取频率。</p>
      </div>
      <SettingsPanel
        title="基础设置"
        fields={[
          { key: "site.name", label: "站点名称" },
          { key: "site.logoUrl", label: "Logo URL" },
          { key: "site.footerText", label: "页脚文本", type: "textarea" },
          { key: "site.termsUrl", label: "服务条款链接" },
          { key: "site.privacyUrl", label: "隐私政策链接" },
          {
            key: "registration.enabled",
            label: "开启用户注册",
            type: "boolean",
            description: "关闭后，新用户将无法注册，已有用户仍可正常登录。"
          },
          {
            key: "registration.allowedDomains",
            label: "允许注册邮箱后缀",
            type: "tags",
            validate: "domain",
            description: "留空表示不限制。添加后，仅允许这些邮箱后缀注册。"
          },
          {
            key: "email.verification.enabled",
            label: "开启邮箱验证",
            type: "boolean",
            description: "开启后，用户注册时需要先接收并输入邮箱验证码，验证通过后才会创建账号。"
          },
          {
            key: "forgotPassword.enabled",
            label: "开启忘记密码",
            type: "boolean",
            description: "开启后，用户可以通过邮箱接收重置链接来修改密码。关闭后，忘记密码入口将隐藏或不可用。"
          },
          {
            key: "claim.rateLimit.perMinute",
            label: "领取频率限制，每分钟",
            type: "number",
            description: "限制同一用户或同一 IP 在单个项目中每分钟最多领取尝试次数。"
          }
        ]}
      />
    </div>
  );
}
