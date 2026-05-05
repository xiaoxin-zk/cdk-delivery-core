import { addMinutes } from "date-fns";
import { ApiError } from "@/lib/api";
import { hashToken } from "@/lib/crypto";
import { buildActionEmail, sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export const REGISTER_CODE_EXPIRES_MINUTES = 10;

function randomVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendRegisterVerificationCode(input: { email: string; passwordHash: string }) {
  const code = randomVerificationCode();
  const expiresAt = addMinutes(new Date(), REGISTER_CODE_EXPIRES_MINUTES);
  await prisma.pendingEmailVerification.upsert({
    where: { email: input.email },
    update: {
      passwordHash: input.passwordHash,
      tokenHash: hashToken(code),
      expiresAt
    },
    create: {
      email: input.email,
      passwordHash: input.passwordHash,
      tokenHash: hashToken(code),
      expiresAt
    }
  });

  try {
    await sendVerificationCodeMail({ email: input.email, code });
  } catch (error) {
    await prisma.pendingEmailVerification.delete({ where: { email: input.email } }).catch(() => undefined);
    throw error;
  }
}

export async function createUserFromRegisterCode(input: { email: string; passwordHash: string; code: string }) {
  const pending = await prisma.pendingEmailVerification.findFirst({
    where: {
      email: input.email,
      tokenHash: hashToken(input.code.trim()),
      expiresAt: { gt: new Date() }
    }
  });
  if (!pending) {
    throw new ApiError("邮箱验证码错误或已过期，请重新获取", 400, "EMAIL_CODE_INVALID");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: input.email } });
    if (existing) {
      if (existing.status === "DELETED") {
        const user = await tx.user.update({
          where: { email: input.email },
          data: {
            passwordHash: input.passwordHash,
            status: "ACTIVE",
            role: "USER",
            emailVerified: true,
            lastLoginAt: null
          },
          select: { id: true, email: true, emailVerified: true }
        });
        await tx.pendingEmailVerification.delete({ where: { id: pending.id } });
        return user;
      }
      await tx.pendingEmailVerification.delete({ where: { id: pending.id } });
      throw new ApiError("该邮箱已被注册", 409, "EMAIL_ALREADY_REGISTERED");
    }
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        emailVerified: true
      },
      select: { id: true, email: true, emailVerified: true }
    });
    await tx.pendingEmailVerification.delete({ where: { id: pending.id } });
    return user;
  });
}

async function sendVerificationCodeMail(input: { email: string; code: string }) {
  try {
    const siteName = await getSetting("site.name");
    await sendMail({
      to: input.email,
      subject: `${siteName} 注册验证码`,
      html: buildActionEmail({
        siteName,
        title: "注册验证码",
        intro: `你的注册验证码是：${input.code}`,
        buttonText: input.code,
        url: `${process.env.APP_URL ?? "http://localhost:3000"}/register`,
        expiresIn: `${REGISTER_CODE_EXPIRES_MINUTES} 分钟`
      })
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("验证码邮件发送失败，请检查邮箱服务配置或联系管理员", 502, "VERIFY_EMAIL_SEND_FAILED");
  }
}
