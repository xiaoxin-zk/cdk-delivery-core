import { ApiError } from "@/lib/api";

export type ClaimIdentity = { userId: string } | { emailOrIdentifier: string };

export function resolveClaimIdentity(input: { userId?: string | null; emailOrIdentifier?: string | null }): ClaimIdentity {
  if (input.userId) return { userId: input.userId };
  const emailOrIdentifier = input.emailOrIdentifier?.trim();
  if (!emailOrIdentifier) {
    throw new ApiError("请提供邮箱或登录后领取", 400, "IDENTIFIER_REQUIRED");
  }
  return { emailOrIdentifier };
}

export function normalizePerUserLimit(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export function assertUserClaimQuota(input: {
  claimMode: "LOTTERY" | "ONCE" | "REPEAT";
  existingClaims?: number;
  existingAttempts?: number;
  perUserLimit?: number | null;
}) {
  const existingClaims = input.existingClaims ?? 0;
  const existingAttempts = input.existingAttempts ?? existingClaims;
  const perUserLimit = normalizePerUserLimit(input.perUserLimit);

  if (input.claimMode === "LOTTERY" && perUserLimit === 1 && existingAttempts > 0) {
    throw new ApiError("你已经参与过该项目抽奖，不能重复参与。", 409, "ALREADY_PARTICIPATED");
  }
  if (input.claimMode === "LOTTERY" && perUserLimit === 1 && existingClaims > 0) {
    throw new ApiError("你已经参与过该项目抽奖，不能重复参与。", 409, "ALREADY_PARTICIPATED");
  }
  if (input.claimMode === "ONCE" && existingClaims > 0) {
    throw new ApiError("你已经领取过该项目的 CDK，不能重复领取。", 409, "ALREADY_CLAIMED");
  }
  const limitCount = input.claimMode === "LOTTERY" ? existingAttempts : existingClaims;
  if (perUserLimit && limitCount >= perUserLimit) {
    throw new ApiError("你的领取次数已达上限。", 409, "USER_LIMIT_REACHED");
  }
}
