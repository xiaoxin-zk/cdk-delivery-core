import nodemailer from "nodemailer";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";
import { asBoolean, getSettingsMap } from "@/lib/settings";

type MailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendMail(input: MailInput) {
  const settings = await getSettingsMap([
    "smtp.host",
    "smtp.port",
    "smtp.username",
    "smtp.password",
    "smtp.fromName",
    "smtp.fromEmail",
    "smtp.secure"
  ]);

  const host = settings.get("smtp.host") ?? "";
  const username = settings.get("smtp.username") ?? "";
  const password = settings.get("smtp.password") ?? "";
  const configuredFromEmail = settings.get("smtp.fromEmail") ?? "";
  const fromEmail = configuredFromEmail === "no-reply@example.com" ? username : configuredFromEmail || username;
  if (!host || !fromEmail) {
    if (env.nodeEnv === "development") {
      console.log("SMTP is not configured. Mail preview:", input);
      return;
    }
    throw new ApiError("邮件服务未配置，请联系管理员", 500, "SMTP_NOT_CONFIGURED");
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(settings.get("smtp.port") ?? "587"),
    secure: asBoolean(settings.get("smtp.secure")),
    auth: username
      ? {
          user: username,
          pass: password
        }
      : undefined
  });

  try {
    await transporter.sendMail({
      to: input.to,
      subject: input.subject,
      from: `"${settings.get("smtp.fromName") ?? "CDK Delivery Core"}" <${fromEmail}>`,
      html: input.html
    });
  } catch (error) {
    console.error("mail send failed", error instanceof Error ? error.message : error);
    throw new ApiError("邮件发送失败，请检查 SMTP 配置或联系管理员", 502, "SMTP_SEND_FAILED");
  }
}

export function buildActionEmail(options: {
  siteName: string;
  title: string;
  intro: string;
  buttonText: string;
  url: string;
  expiresIn: string;
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f7f5ef;font-family:Arial,sans-serif;color:#151923">
    <table width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
      <tr><td align="center">
        <table width="100%" style="max-width:560px;background:#fff;border:1px solid #ded7cb;border-radius:8px;padding:28px">
          <tr><td>
            <h1 style="font-size:22px;margin:0 0 12px">${options.siteName}</h1>
            <h2 style="font-size:18px;margin:0 0 16px">${options.title}</h2>
            <p style="line-height:1.7;margin:0 0 24px">${options.intro}</p>
            <a href="${options.url}" style="display:inline-block;background:#2f7a6d;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px">${options.buttonText}</a>
            <p style="line-height:1.7;color:#566;margin:24px 0 0">链接有效期：${options.expiresIn}。如果不是你本人操作，请忽略本邮件并尽快修改密码。</p>
            <p style="word-break:break-all;color:#566;font-size:12px;margin-top:18px">${options.url}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
