import { addHours } from "date-fns";
import { ApiError } from "@/lib/api";
import { hashToken, randomToken } from "@/lib/crypto";
import { buildActionEmail, sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

type VerificationMailInput = {
  email: string;
  token: string;
};

export async function createPendingEmailVerification(input: { email: string; passwordHash: string }) {
  const token = randomToken();
  const expiresAt = addHours(new Date(), 24);
  await prisma.pendingEmailVerification.upsert({
    where: { email: input.email },
    update: {
      passwordHash: input.passwordHash,
      tokenHash: hashToken(token),
      expiresAt
    },
    create: {
      email: input.email,
      passwordHash: input.passwordHash,
      tokenHash: hashToken(token),
      expiresAt
    }
  });

  try {
    await sendVerificationMail({ email: input.email, token });
  } catch (error) {
    await prisma.pendingEmailVerification.delete({ where: { email: input.email } }).catch(() => undefined);
    throw error;
  }
}

export async function resendPendingVerificationEmail(email: string) {
  const pending = await prisma.pendingEmailVerification.findUnique({ where: { email } });
  if (!pending) {
    throw new ApiError("未找到待验证注册记录，请重新注册", 404, "PENDING_VERIFICATION_NOT_FOUND");
  }

  const token = randomToken();
  await prisma.pendingEmailVerification.update({
    where: { email },
    data: {
      tokenHash: hashToken(token),
      expiresAt: addHours(new Date(), 24)
    }
  });

  try {
    await sendVerificationMail({ email, token });
  } catch (error) {
    throw error;
  }
}

async function sendVerificationMail(input: VerificationMailInput) {
  try {
    const siteName = await getSetting("site.name");
    await sendMail({
      to: input.email,
      subject: `验证你的 ${siteName} 邮箱`,
      html: buildActionEmail({
        siteName,
        title: "邮箱验证",
        intro: "点击下方按钮完成邮箱验证。",
        buttonText: "验证邮箱",
        url: `${process.env.APP_URL ?? "http://localhost:3000"}/verify-email?token=${input.token}`,
        expiresIn: "24 小时"
      })
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("验证邮件发送失败，请检查邮箱服务配置或联系管理员", 502, "VERIFY_EMAIL_SEND_FAILED");
  }
}
