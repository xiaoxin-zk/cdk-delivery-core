import { z } from "zod";
import { isValidImageUrl } from "@/lib/image-url";

export const emailSchema = z.string().email("邮箱格式不正确").max(254);
export const domainSuffixSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => !value.startsWith("@"), "邮箱后缀不要包含 @")
  .refine((value) => !/^https?:\/\//i.test(value), "邮箱后缀不要包含 http:// 或 https://")
  .refine(
    (value) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(value),
    "邮箱后缀格式不正确"
  );
export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .max(128, "密码过长")
  .regex(/[A-Za-z]/, "密码需要包含字母")
  .regex(/[0-9]/, "密码需要包含数字");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  emailCode: z.string().trim().regex(/^\d{6}$/, "请输入 6 位邮箱验证码").optional(),
  turnstileToken: z.string().optional()
});

export const sendRegisterCodeSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  turnstileToken: z.string().optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "请输入密码"),
  remember: z.boolean().optional(),
  turnstileToken: z.string().optional()
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  turnstileToken: z.string().optional()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: passwordSchema
});

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null));

const optionalNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  })
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), "请输入大于 0 的整数");

const lotteryProbabilitySchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === "" || value === null || value === undefined) return 100;
    const number = Number(value);
    return Number.isFinite(number) ? number : 100;
  })
  .refine((value) => Number.isInteger(value) && value >= 1 && value <= 100, "抽奖概率必须是 1 到 100 的整数");

export const coverImageUrlSchema = z
  .string()
  .trim()
  .refine((value) => isValidImageUrl(value), "请输入有效的图片 URL");

export const projectSchema = z.object({
  name: z.string().trim().min(2, "项目名称至少 2 个字符").max(120),
  description: z.string().trim().min(2, "请填写项目描述").max(500),
  content: z.string().trim().min(1, "请填写项目介绍").max(5000),
  instructions: z.string().trim().max(5000).default(""),
  coverImage: coverImageUrlSchema.optional().default(""),
  status: z.enum(["DRAFT", "PUBLIC", "PAUSED", "ENDED"]).default("DRAFT"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  claimMode: z.enum(["LOTTERY", "ONCE", "REPEAT"]).default("LOTTERY"),
  lotteryProbability: lotteryProbabilitySchema,
  requireLogin: z.boolean().default(true),
  startAt: optionalDate,
  endAt: optionalDate,
  dailyLimit: optionalNumber,
  totalLimit: optionalNumber,
  perUserLimit: optionalNumber,
  illegalConfirmed: z.boolean().refine(Boolean, "必须确认项目不涉及违法违规内容"),
  turnstileToken: z.string().optional()
});

export const projectUpdateSchema = projectSchema.partial().extend({
  illegalConfirmed: z.boolean().optional(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  reviewReason: z.string().max(1000).optional().nullable()
});

export const cdkImportSchema = z.object({
  text: z.string().min(1, "请输入 CDK").max(200000)
});

export const claimSchema = z.object({
  emailOrIdentifier: z.string().max(254).optional(),
  turnstileToken: z.string().optional()
});

export function splitCdkLines(text: string) {
  return text
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line))
    .filter((line) => line.length > 0);
}

export function splitListInput(text: string) {
  return text
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeDomainSuffix(value: string) {
  return domainSuffixSchema.safeParse(value);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
