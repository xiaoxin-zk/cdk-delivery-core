import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { assertUserClaimQuota, normalizePerUserLimit, resolveClaimIdentity } from "@/lib/claim-policy";
import { prisma } from "@/lib/prisma";

type ClaimInput = {
  projectId: string;
  user: AuthUser | null;
  emailOrIdentifier?: string;
  ip?: string;
  userAgent?: string;
};

type ClaimSuccess = {
  success: true;
  won: true;
  message: string;
  claim: {
    id: string;
    claimedAt: Date;
  };
  cdk: {
    id: string;
    code: string;
  };
  participationConsumed: true;
  canRetry: boolean;
};

type ClaimMiss = {
  success: true;
  won: false;
  message: string;
  participationConsumed: true;
  canRetry: boolean;
};

export async function claimRandomCdk(input: ClaimInput) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await claimRandomCdkOnce(input);
    } catch (error) {
      if (attempt < 3 && isRetryableClaimConflict(error)) continue;
      throw error;
    }
  }
  throw new ApiError("该项目的 CDK 已全部发放完毕", 409, "NO_CDK_AVAILABLE");
}

function isRetryableClaimConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

async function claimRandomCdkOnce(input: ClaimInput) {
  return prisma.$transaction(
    async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: input.projectId },
        select: {
          id: true,
          status: true,
          reviewStatus: true,
          visibility: true,
          claimMode: true,
          lotteryProbability: true,
          requireLogin: true,
          startAt: true,
          endAt: true,
          dailyLimit: true,
          totalLimit: true,
          perUserLimit: true
        }
      });

      if (!project) throw new ApiError("项目不存在", 404, "PROJECT_NOT_FOUND");
      assertProjectClaimable(project, Boolean(input.user));
      const perUserLimit = normalizePerUserLimit(project.perUserLimit);

      const identityWhere = resolveClaimIdentity({
        userId: input.user?.id,
        emailOrIdentifier: input.emailOrIdentifier
      });
      const claimIdentifier = input.user
        ? input.user.email
        : "emailOrIdentifier" in identityWhere
          ? identityWhere.emailOrIdentifier
          : undefined;

      const currentModeClaimWhere = {
        projectId: project.id,
        claimModeSnapshot: project.claimMode,
        ...identityWhere
      };
      const currentLotteryAttemptWhere = {
        projectId: project.id,
        claimModeSnapshot: "LOTTERY" as const,
        ...identityWhere
      };

      const [existingClaims, existingAttempts, existingSuccessfulClaims] = await Promise.all([
        tx.claim.count({ where: currentModeClaimWhere }),
        tx.claimAttempt.count({ where: currentLotteryAttemptWhere }),
        tx.claim.count({ where: { projectId: project.id, ...identityWhere } })
      ]);
      assertUserClaimQuota({
        claimMode: project.claimMode,
        existingClaims: project.claimMode === "ONCE" ? existingSuccessfulClaims : existingClaims,
        existingAttempts,
        perUserLimit
      });

      if (project.totalLimit) {
        const total =
          project.claimMode === "LOTTERY"
            ? await tx.claimAttempt.count({ where: { projectId: project.id, claimModeSnapshot: "LOTTERY" } })
            : await tx.claim.count({ where: { projectId: project.id, claimModeSnapshot: project.claimMode } });
        if (total >= project.totalLimit) throw new ApiError("项目领取总量已达上限", 409, "TOTAL_LIMIT_REACHED");
      }

      if (project.dailyLimit) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const daily =
          project.claimMode === "LOTTERY"
            ? await tx.claimAttempt.count({
                where: { projectId: project.id, claimModeSnapshot: "LOTTERY", createdAt: { gte: start } }
              })
            : await tx.claim.count({
                where: { projectId: project.id, claimModeSnapshot: project.claimMode, createdAt: { gte: start } }
              });
        if (daily >= project.dailyLimit) throw new ApiError("今日领取次数已达上限", 409, "DAILY_LIMIT_REACHED");
      }

      if (project.claimMode === "LOTTERY") {
        const probability = Math.min(100, Math.max(1, project.lotteryProbability ?? 100));
        if (Math.random() * 100 >= probability) {
          const canRetry = !perUserLimit || existingAttempts + 1 < perUserLimit;
          await tx.claimAttempt.create({
            data: {
              projectId: project.id,
              userId: input.user?.id,
              emailOrIdentifier: claimIdentifier,
              result: "LOST",
              claimModeSnapshot: project.claimMode,
              ip: input.ip,
              userAgent: input.userAgent
            }
          });
          return {
            success: true,
            won: false,
            message: canRetry ? "很遗憾，本次未中奖，你可以再次尝试。" : "很遗憾，本次未中奖。",
            participationConsumed: true,
            canRetry
          } satisfies ClaimMiss;
        }
      }

      const rows = await tx.$queryRaw<Array<{ id: string; code: string }>>(
        Prisma.sql`
          SELECT "id", "code"
          FROM "cdks"
          WHERE "project_id" = ${project.id}
            AND "status" = 'AVAILABLE'::"CdkStatus"
            AND "claimed_by" IS NULL
          ORDER BY random()
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `
      );
      const selected = rows[0];
      if (!selected) throw new ApiError("该项目的 CDK 已全部发放完毕", 409, "NO_CDK_AVAILABLE");

      const now = new Date();
      const updated = await tx.cdk.updateMany({
        where: { id: selected.id, status: "AVAILABLE", claimedBy: null },
        data: {
          status: "CLAIMED",
          claimedBy: input.user?.id,
          claimedAt: now
        }
      });
      if (updated.count !== 1) {
        throw new ApiError("该项目的 CDK 已全部发放完毕", 409, "NO_CDK_AVAILABLE");
      }

      const claim = await tx.claim.create({
        data: {
          projectId: project.id,
          cdkId: selected.id,
          userId: input.user?.id,
          emailOrIdentifier: claimIdentifier,
          claimModeSnapshot: project.claimMode,
          ip: input.ip,
          userAgent: input.userAgent
        }
      });
      await tx.claimAttempt.create({
        data: {
          projectId: project.id,
          cdkId: selected.id,
          userId: input.user?.id,
          emailOrIdentifier: claimIdentifier,
          result: "WON",
          claimModeSnapshot: project.claimMode,
          ip: input.ip,
          userAgent: input.userAgent
        }
      });

      const canRetry =
        project.claimMode === "REPEAT"
          ? !perUserLimit || existingClaims + 1 < perUserLimit
          : project.claimMode === "LOTTERY" && (!perUserLimit || existingAttempts + 1 < perUserLimit);

      return {
        success: true,
        won: true,
        message: "领取成功",
        claim: {
          id: claim.id,
          claimedAt: claim.createdAt
        },
        cdk: {
          id: selected.id,
          code: selected.code
        },
        participationConsumed: true,
        canRetry
      } satisfies ClaimSuccess;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export function assertProjectClaimable(
  project: {
    status: string;
    reviewStatus: string;
    visibility: string;
    requireLogin: boolean;
    startAt: Date | null;
    endAt: Date | null;
  },
  loggedIn: boolean
) {
  const now = new Date();
  if (project.visibility !== "PUBLIC") throw new ApiError("项目未公开", 403, "PROJECT_PRIVATE");
  if (project.reviewStatus !== "APPROVED") throw new ApiError("该项目尚未审核通过，暂不能领取", 409, "PROJECT_NOT_APPROVED");
  if (project.status === "ENDED") throw new ApiError("项目已结束", 409, "PROJECT_ENDED");
  if (project.status !== "PUBLIC") throw new ApiError("该项目暂不可参与", 409, "PROJECT_NOT_CLAIMABLE");
  if (project.startAt && project.startAt > now) throw new ApiError("项目尚未开始", 409, "PROJECT_NOT_STARTED");
  if (project.endAt && project.endAt < now) throw new ApiError("项目已结束", 409, "PROJECT_ENDED");
  if (project.requireLogin && !loggedIn) throw new ApiError("请先登录后再领取", 401, "LOGIN_REQUIRED");
}

export function getClaimUnavailableReason(
  project: {
    status: string;
    reviewStatus: string;
    visibility: string;
    requireLogin: boolean;
    startAt: Date | null;
    endAt: Date | null;
    dailyLimit: number | null;
    totalLimit: number | null;
    perUserLimit: number | null;
    claimMode: string;
    lotteryProbability?: number | null;
  },
  state: {
    loggedIn: boolean;
    availableCount: number;
    totalClaims: number;
    todayClaims: number;
    userClaims: number;
    userAttempts?: number;
  }
) {
  const now = new Date();
  if (project.visibility !== "PUBLIC") return "项目未公开";
  if (project.reviewStatus !== "APPROVED") return "该项目尚未审核通过，暂不能领取";
  if (project.status === "PAUSED") return "项目已暂停";
  if (project.status === "ENDED") return "项目已结束";
  if (project.status !== "PUBLIC") return "该项目暂不可参与";
  if (project.startAt && project.startAt > now) return "项目尚未开始";
  if (project.endAt && project.endAt < now) return "项目已结束";
  if (project.requireLogin && !state.loggedIn) return "请先登录后再领取";
  if (state.availableCount <= 0) return "该项目的 CDK 已全部发放完毕";
  if (project.totalLimit && state.totalClaims >= project.totalLimit) return "项目领取总量已达上限";
  if (project.dailyLimit && state.todayClaims >= project.dailyLimit) return "今日领取次数已达上限";
  const userAttempts = state.userAttempts ?? state.userClaims;
  const perUserLimit = normalizePerUserLimit(project.perUserLimit);
  if (project.claimMode === "LOTTERY") {
    if (perUserLimit === 1 && userAttempts > 0) return "你已经参与过该项目抽奖，不能重复参与。";
    if (perUserLimit && userAttempts >= perUserLimit) return "你的领取次数已达上限。";
    return "";
  }
  if (project.claimMode === "ONCE" && state.userClaims > 0) return "你已经领取过该项目的 CDK，不能重复领取。";
  if (perUserLimit && state.userClaims >= perUserLimit) return "你的领取次数已达上限。";
  return "";
}
