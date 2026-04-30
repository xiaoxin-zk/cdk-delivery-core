import { SensitiveWordsPanel } from "@/components/admin/SensitiveWordsPanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";

export default function AdminSecurityPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">安全设置</h1>
        <p className="mt-2 text-ink/60">配置项目审核、防滥用和敏感词策略，降低违法违规内容风险。</p>
      </div>
      <SettingsPanel
        title="审核策略"
        fields={[
          {
            key: "project.review.enabled",
            label: "开启项目审核",
            type: "boolean",
            description: "开启后，项目需要管理员审核通过后才会公开展示。"
          },
          {
            key: "project.review.userRequired",
            label: "普通用户项目必须人工审核",
            type: "boolean",
            description: "开启后，普通用户创建或编辑项目都会进入待审核状态。"
          },
          {
            key: "sensitiveWords.enabled",
            label: "开启敏感词检测",
            type: "boolean",
            description: "用于拦截违法违规内容。项目名称、描述、内容和使用说明命中敏感词时，将禁止发布或进入待审核状态。"
          },
          {
            key: "sensitiveWords.mode",
            label: "敏感词命中处理",
            type: "select",
            description: "选择命中敏感词后进入待审核，或直接阻止创建和保存。",
            options: [
              { value: "review", label: "进入待审核" },
              { value: "block", label: "阻止创建/保存" }
            ]
          }
        ]}
      />
      <SettingsPanel
        title="Cloudflare Turnstile"
        fields={[
          { key: "turnstile.enabled", label: "开启 Turnstile", type: "boolean", description: "用于防止机器人自动注册、登录、领取 CDK 或创建项目。开启后，所选场景会要求用户完成人机验证。" },
          { key: "turnstile.siteKey", label: "Site Key", description: "前端展示 Turnstile 小组件需要使用的公开 Key。" },
          { key: "turnstile.secretKey", label: "Secret Key", type: "password", description: "后端验证 Turnstile Token 的密钥，保存后后台只显示已配置。" },
          { key: "turnstile.register.enabled", label: "注册时启用", type: "boolean" },
          { key: "turnstile.login.enabled", label: "登录时启用", type: "boolean" },
          { key: "turnstile.forgotPassword.enabled", label: "忘记密码时启用", type: "boolean" },
          { key: "turnstile.claim.enabled", label: "领取 CDK 时启用", type: "boolean" },
          { key: "turnstile.createProject.enabled", label: "创建项目时启用", type: "boolean" }
        ]}
      />
      <SensitiveWordsPanel />
    </div>
  );
}
