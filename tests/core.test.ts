import { existsSync, readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { api } from "@/components/api";
import {
  ClaimResultCard,
  COPY_SUCCESS_MESSAGE,
  MISSING_CDK_ERROR,
  claimResultFromResponse,
  copyCdkToClipboard
} from "@/components/projects/ClaimPanel";
import { assertUserClaimQuota, resolveClaimIdentity } from "@/lib/claim-policy";
import { assertProjectClaimable, getClaimUnavailableReason } from "@/lib/claims";
import { canEditResource } from "@/lib/domain";
import { shouldReviewProject } from "@/lib/domain";
import { claimModeDescription, claimModeLabel, claimRuleDescription, statusLabel } from "@/lib/labels";
import { extractReviewMatchedFields } from "@/lib/project-review";
import { isEmailDomainAllowed } from "@/lib/security";
import { asList } from "@/lib/settings";
import { projectSchema, projectUpdateSchema, splitCdkLines } from "@/lib/validators";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function expectApiError(fn: () => unknown, code: string, message?: string) {
  try {
    fn();
    throw new Error("Expected ApiError");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    if (message) expect((error as ApiError).message).toBe(message);
  }
}

describe("注册策略", () => {
  it("支持邮箱后缀白名单", () => {
    expect(isEmailDomainAllowed("user@gmail.com", ["gmail.com", "outlook.com"])).toBe(true);
    expect(isEmailDomainAllowed("user@example.com", ["gmail.com", "outlook.com"])).toBe(false);
    expect(isEmailDomainAllowed("user@example.com", [])).toBe(true);
  });

  it("邮箱后缀配置支持 JSON 数组和旧分隔格式", () => {
    expect(asList("[\"qq.com\",\"gmail.com\"]")).toEqual(["qq.com", "gmail.com"]);
    expect(asList("qq.com，gmail.com outlook.com")).toEqual(["qq.com", "gmail.com", "outlook.com"]);
  });
});

describe("CDK 导入", () => {
  it("保留 CDK 原始大小写和空格", () => {
    expect(splitCdkLines("AbC-123\nlower-code\n  Keep Space  \r\n")).toEqual([
      "AbC-123",
      "lower-code",
      "  Keep Space  "
    ]);
  });
});

describe("领取策略", () => {
  it("抽奖模式会从剩余 CDK 中随机发放一个未领取 CDK", () => {
    const fn = source("src/lib/claims.ts");
    expect(fn).toContain("ORDER BY random()");
    expect(fn).toContain("status\" = 'AVAILABLE'");
    expect(fn).toContain("claimed_by\" IS NULL");
    expect(fn).toContain("该项目的 CDK 已全部发放完毕");
    expect(fn).toContain("return {");
  });

  it("概率抽奖第一次未中奖返回成功结果并记录参与", () => {
    const claimSource = source("src/lib/claims.ts");
    expect(claimSource).toContain("tx.claimAttempt.create");
    expect(claimSource).toContain("result: \"LOST\"");
    expect(claimSource).toContain("won: false");
    expect(claimSource).toContain("很遗憾，本次未中奖");
    expect(claimSource).not.toContain("throw new ApiError(\"本次未中奖");
  });

  it("概率抽奖每人一次会按参与记录拦截重复参与", () => {
    try {
      assertUserClaimQuota({ claimMode: "LOTTERY", existingClaims: 0, existingAttempts: 1, perUserLimit: 1 });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("ALREADY_PARTICIPATED");
      expect((error as ApiError).message).toBe("你已经参与过该项目抽奖，不能重复参与。");
    }
  });

  it("抽奖未中奖后切换为每人一次时不按参与记录拦截领取", () => {
    expect(() =>
      assertUserClaimQuota({ claimMode: "ONCE", existingClaims: 0, existingAttempts: 1, perUserLimit: 1 })
    ).not.toThrow();
  });

  it("抽奖中奖后切换为每人一次时返回已领取", () => {
    try {
      assertUserClaimQuota({ claimMode: "ONCE", existingClaims: 1, existingAttempts: 1, perUserLimit: 1 });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("ALREADY_CLAIMED");
      expect((error as ApiError).message).toBe("你已经领取过该项目的 CDK，不能重复领取。");
    }
  });

  it("每人一次领取过后切换为可重复且没有单用户限制时允许再次领取", () => {
    expect(() =>
      assertUserClaimQuota({ claimMode: "REPEAT", existingClaims: 1, existingAttempts: 1, perUserLimit: null })
    ).not.toThrow();
  });

  it("项目创建默认支持抽奖模式", () => {
    const parsed = projectSchema.parse({
      name: "抽奖项目",
      description: "测试抽奖领取",
      content: "项目内容",
      status: "PUBLIC",
      visibility: "PUBLIC",
      requireLogin: true,
      illegalConfirmed: true
    });
    expect(parsed.claimMode).toBe("LOTTERY");
    expect(parsed.lotteryProbability).toBe(100);
  });

  it("抽奖概率必须在 1 到 100 之间", () => {
    expect(
      projectSchema.parse({
        name: "概率项目",
        description: "测试抽奖概率",
        content: "项目内容",
        claimMode: "LOTTERY",
        lotteryProbability: 35,
        illegalConfirmed: true
      }).lotteryProbability
    ).toBe(35);
    expect(() =>
      projectSchema.parse({
        name: "概率项目",
        description: "测试抽奖概率",
        content: "项目内容",
        claimMode: "LOTTERY",
        lotteryProbability: 0,
        illegalConfirmed: true
      })
    ).toThrow();
  });

  it("抽奖模式允许再次尝试但仍遵守单用户上限", () => {
    expect(() => assertUserClaimQuota({ claimMode: "LOTTERY", existingClaims: 1, perUserLimit: null })).not.toThrow();
    try {
      assertUserClaimQuota({ claimMode: "LOTTERY", existingClaims: 1, existingAttempts: 1, perUserLimit: 1 });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("ALREADY_PARTICIPATED");
      expect((error as ApiError).message).toBe("你已经参与过该项目抽奖，不能重复参与。");
    }
  });

  it("每个用户只能领取一次模式会阻止重复领取", () => {
    try {
      assertUserClaimQuota({ claimMode: "ONCE", existingClaims: 1, perUserLimit: null });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("ALREADY_CLAIMED");
    }
  });

  it("可重复领取模式允许多次领取但遵守单用户上限", () => {
    expect(() => assertUserClaimQuota({ claimMode: "REPEAT", existingClaims: 1, perUserLimit: 3 })).not.toThrow();
    try {
      assertUserClaimQuota({ claimMode: "REPEAT", existingClaims: 3, perUserLimit: 3 });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("USER_LIMIT_REACHED");
    }
  });

  it("领取事务包含行级锁和跳过已锁定行，避免并发重复发放", () => {
    const claimSource = source("src/lib/claims.ts");
    expect(claimSource).toContain("FOR UPDATE SKIP LOCKED");
    expect(claimSource).toContain("Serializable");
    expect(claimSource).toContain("lotteryProbability");
    expect(claimSource).toContain("updateMany");
    expect(claimSource).toContain("where: { id: selected.id, status: \"AVAILABLE\", claimedBy: null }");
    expect(claimSource).toContain("claimModeSnapshot: project.claimMode");
    expect(claimSource).toContain("P2034");
    expect(claimSource).toContain("NO_CDK_AVAILABLE");
  });

  it("领取成功响应包含 claim 和 cdk，且不把 CDK 大小写做转换", () => {
    const claimSource = source("src/lib/claims.ts");
    expect(claimSource).toContain("message: \"领取成功\"");
    expect(claimSource).toContain("claim: {");
    expect(claimSource).toContain("id: claim.id");
    expect(claimSource).toContain("claimedAt: claim.createdAt");
    expect(claimSource).toContain("cdk: {");
    expect(claimSource).toContain("id: selected.id");
    expect(claimSource).toContain("code: selected.code");
    expect(claimSource).not.toContain("code: selected.code.toUpperCase");
    expect(claimSource).not.toContain("code: selected.code.toLowerCase");
  });

  it("每日限制达到后返回中文原因", () => {
    const reason = getClaimUnavailableReason(
      {
        status: "PUBLIC",
        reviewStatus: "APPROVED",
        visibility: "PUBLIC",
        requireLogin: false,
        startAt: null,
        endAt: null,
        dailyLimit: 1,
        totalLimit: null,
        perUserLimit: null,
        claimMode: "REPEAT"
      },
      { loggedIn: true, availableCount: 3, totalClaims: 0, todayClaims: 1, userClaims: 0 }
    );
    expect(reason).toBe("今日领取次数已达上限");
  });

  it("项目详情页显示概率抽奖参与规则", () => {
    expect(claimRuleDescription({ claimMode: "LOTTERY", perUserLimit: 1 })).toBe(
      "抽奖规则：每个用户只能参与一次。未中奖也会消耗参与机会。"
    );
    expect(claimRuleDescription({ claimMode: "LOTTERY", perUserLimit: null })).toBe(
      "抽奖规则：用户可以重复参与，直到达到项目设置的参与次数限制。"
    );
    expect(claimRuleDescription({ claimMode: "REPEAT" })).toBe("领取规则：系统会从剩余 CDK 中随机发放一个。");
  });

  it("不可领取原因会返回中文提示", () => {
    const reason = getClaimUnavailableReason(
      {
        status: "PUBLIC",
        reviewStatus: "APPROVED",
        visibility: "PUBLIC",
        requireLogin: true,
        startAt: null,
        endAt: null,
        dailyLimit: null,
        totalLimit: null,
        perUserLimit: null,
        claimMode: "ONCE"
      },
      { loggedIn: false, availableCount: 1, totalClaims: 0, todayClaims: 0, userClaims: 0 }
    );
    expect(reason).toBe("请先登录后再领取");
  });

  it("当前每人一次模式只按成功领取记录显示已领取", () => {
    const missThenOnce = getClaimUnavailableReason(
      {
        status: "PUBLIC",
        reviewStatus: "APPROVED",
        visibility: "PUBLIC",
        requireLogin: false,
        startAt: null,
        endAt: null,
        dailyLimit: null,
        totalLimit: null,
        perUserLimit: 1,
        claimMode: "ONCE"
      },
      { loggedIn: true, availableCount: 1, totalClaims: 0, todayClaims: 0, userClaims: 0, userAttempts: 1 }
    );
    expect(missThenOnce).toBe("");
    const wonThenOnce = getClaimUnavailableReason(
      {
        status: "PUBLIC",
        reviewStatus: "APPROVED",
        visibility: "PUBLIC",
        requireLogin: false,
        startAt: null,
        endAt: null,
        dailyLimit: null,
        totalLimit: null,
        perUserLimit: 1,
        claimMode: "ONCE"
      },
      { loggedIn: true, availableCount: 1, totalClaims: 1, todayClaims: 0, userClaims: 1, userAttempts: 1 }
    );
    expect(wonThenOnce).toBe("你已经领取过该项目的 CDK，不能重复领取。");
  });
});

describe("领取前端交互", () => {
  it("api 会解析 409 响应里的中文 message 和 code", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "你已经领取过该项目的 CDK", code: "ALREADY_CLAIMED" }), {
        status: 409,
        headers: { "content-type": "application/json; charset=utf-8" }
      })
    ) as typeof fetch;

    await expect(api("/api/projects/example/claim")).rejects.toMatchObject({
      message: "你已经领取过该项目的 CDK",
      code: "ALREADY_CLAIMED",
      status: 409
    });
    globalThis.fetch = originalFetch;
  });

  it("ClaimPanel 使用 loading 和 submittingRef 防止重复提交", () => {
    const panel = source("src/components/projects/ClaimPanel.tsx");
    expect(panel).toContain("submittingRef.current");
    expect(panel).toContain("if (submittingRef.current) return;");
    expect(panel).toContain("onSubmit={handleSubmit}");
    expect(panel).toContain("type=\"submit\" disabled={loading || Boolean(terminalReason)}");
  });

  it("ClaimPanel 能区分未中奖、已参与、已领完和中奖", () => {
    const panel = source("src/components/projects/ClaimPanel.tsx");
    expect(panel).toContain("getLocalLimitState");
    expect(panel).toContain("你已经参与过该项目抽奖，不能重复参与。");
    expect(panel).toContain("该项目的 CDK 已全部发放完毕。");
    expect(panel).toContain("恭喜中奖！");
    expect(panel).toContain("ALREADY_PARTICIPATED");
    expect(panel).toContain("次数已达上限");
    expect(panel).toContain("立即抽奖");
  });

  it("ClaimPanel 领取成功后读取 cdk.code 和 claim.claimedAt 并显示复制反馈", () => {
    const panel = source("src/components/projects/ClaimPanel.tsx");
    expect(panel).toContain("const cdkCode = data.cdk?.code");
    expect(panel).toContain("const claimedAt = data.claim?.claimedAt");
    expect(panel).toContain("claimResultFromResponse(data)");
    expect(panel).toContain("领取成功，但未返回 CDK，请联系管理员。");
    expect(panel).toContain("console.error(\"领取成功响应缺少 CDK\", data)");
    expect(panel).toContain("CDK 已复制");
    expect(panel).toContain("onCopy(result.code)");
  });

  it("mock 成功响应包含 cdk.code 后，ClaimPanel 解析并保持 CDK 大小写", () => {
    const parsed = claimResultFromResponse({
      success: true,
      won: true,
      message: "领取成功",
      claim: { id: "claim-1", claimedAt: "2026-04-30T10:00:00.000Z" },
      cdk: { id: "cdk-1", code: "Test-Key-789" }
    });

    expect(parsed.error).toBe("");
    expect(parsed.result).toEqual({
      code: "Test-Key-789",
      claimedAt: "2026-04-30T10:00:00.000Z"
    });
  });

  it("ClaimPanel 结果卡片显示 CDK、复制按钮、领取时间、使用说明和复制成功反馈", () => {
    const html = renderToStaticMarkup(
      React.createElement(ClaimResultCard, {
        claimMode: "REPEAT",
        result: { code: "Test-Key-789", claimedAt: "2026-04-30T10:00:00.000Z" },
        instructions: "兑换时请保持原始大小写",
        copyMessage: COPY_SUCCESS_MESSAGE,
        onCopy: () => undefined
      })
    );

    expect(html).toContain("领取成功");
    expect(html).toContain("Test-Key-789");
    expect(html).toContain("复制");
    expect(html).toContain("CDK 已复制");
    expect(html).toContain("领取时间：");
    expect(html).toContain("使用说明：兑换时请保持原始大小写");
  });

  it("ClaimPanel 结果卡片在使用说明为空时显示暂无说明", () => {
    const html = renderToStaticMarkup(
      React.createElement(ClaimResultCard, {
        claimMode: "REPEAT",
        result: { code: "ABC-123", claimedAt: "2026-04-30T10:00:00.000Z" },
        instructions: "",
        copyMessage: "",
        onCopy: () => undefined
      })
    );

    expect(html).toContain("使用说明：暂无说明");
  });

  it("复制按钮逻辑写入原始 CDK 并返回复制成功反馈", async () => {
    const calls: string[] = [];
    const message = await copyCdkToClipboard("Test-Key-789", {
      writeText: async (value) => {
        calls.push(value);
      }
    });

    expect(calls).toEqual(["Test-Key-789"]);
    expect(message).toBe("CDK 已复制");
  });

  it("成功领取响应缺少 cdk.code 时显示联系管理员错误", () => {
    const parsed = claimResultFromResponse({
      success: true,
      won: true,
      message: "领取成功",
      claim: { id: "claim-1", claimedAt: "2026-04-30T10:00:00.000Z" }
    });

    expect(parsed.result).toBeNull();
    expect(parsed.error).toBe(MISSING_CDK_ERROR);
  });

  it("成功领取后不会调用 router.refresh 清空结果", () => {
    const panel = source("src/components/projects/ClaimPanel.tsx");
    expect(panel).not.toContain("useRouter");
    expect(panel).not.toContain("router.refresh()");
    expect(panel).toContain("setResult(parsedResult.result)");
    expect(panel).toContain("writeStoredClaimResult(projectId, parsedResult.result)");
  });
});

describe("领取记录展示", () => {
  it("用户中心领取记录只查询当前用户并显示项目使用说明", () => {
    const page = source("src/app/dashboard/claims/page.tsx");
    expect(page).toContain("where: { userId: user.id }");
    expect(page).toContain("instructions: true");
    expect(page).toContain("使用说明");
    expect(page).toContain("claim.project.instructions || \"暂无说明\"");
  });

  it("用户领取记录接口返回自己的 CDK 和使用说明", () => {
    const route = source("src/app/api/me/claims/route.ts");
    expect(route).toContain("const where = { userId: user.id }");
    expect(route).toContain("instructions: true");
    expect(route).toContain("cdk: { select: { id: true, code: true, status: true } }");
  });

  it("后台和项目 CDK 管理显示领取人、领取时间和 IP 信息", () => {
    const manager = source("src/components/projects/CdkManager.tsx");
    const adminCdks = source("src/app/admin/cdks/page.tsx");
    const adminClaims = source("src/app/admin/claims/page.tsx");
    expect(manager).toContain("item.claimer?.email ?? item.claim?.emailOrIdentifier");
    expect(manager).toContain("item.claimedAt ? dateTimeLabel(item.claimedAt)");
    expect(manager).toContain("item.claim?.ip");
    expect(adminCdks).toContain("cdk.claimedAt ? dateTimeLabel(cdk.claimedAt)");
    expect(adminClaims).toContain("claimModeLabel(attempt.claimModeSnapshot)");
    expect(adminClaims).toContain("attempt.cdk?.code");
  });

  it("项目详情页刷新后会把登录用户最近领取的 CDK 传给 ClaimPanel", () => {
    const page = source("src/app/projects/[id]/page.tsx");
    expect(page).toContain("latestUserClaim");
    expect(page).toContain("prisma.claim.findFirst");
    expect(page).toContain("where: { projectId: project.id, userId: user.id }");
    expect(page).toContain("select: { createdAt: true, cdk: { select: { code: true } } }");
    expect(page).toContain("initialResult={");
    expect(page).toContain("code: latestUserClaim.cdk.code");
    expect(page).toContain("claimedAt: latestUserClaim.createdAt.toISOString()");
  });
});

describe("项目权限", () => {
  it("普通用户不能编辑别人的项目，管理员可以管理所有项目", () => {
    expect(canEditResource({ id: "u1", role: "USER" }, "u2")).toBe(false);
    expect(canEditResource({ id: "u1", role: "USER" }, "u1")).toBe(true);
    expect(canEditResource({ id: "admin", role: "ADMIN" }, "u1")).toBe(true);
  });

  it("审核策略支持敏感词进入待审或阻止", () => {
    expect(shouldReviewProject({ reviewEnabled: false, sensitiveMode: "review", matchedWords: ["bad"] })).toBe("REVIEW");
    expect(shouldReviewProject({ reviewEnabled: false, sensitiveMode: "block", matchedWords: ["bad"] })).toBe("BLOCK");
    expect(shouldReviewProject({ reviewEnabled: false, sensitiveMode: "review", matchedWords: [] })).toBe("APPROVE");
    expect(extractReviewMatchedFields("命中敏感词：项目名称：bad；使用说明：bad")).toEqual(["项目名称", "使用说明"]);
  });
});

describe("项目封面图", () => {
  it("允许无扩展名或带查询参数的 HTTP 图片 URL", () => {
    const parsed = projectSchema.parse({
      name: "封面项目",
      description: "测试封面图 URL",
      content: "项目内容",
      coverImage: "https://picsum.photos/800/450?random=1",
      illegalConfirmed: true
    });
    expect(parsed.coverImage).toBe("https://picsum.photos/800/450?random=1");
  });

  it("无效封面图 URL 会返回中文错误", () => {
    const invalid = projectSchema.safeParse({
      name: "封面项目",
      description: "测试封面图 URL",
      content: "项目内容",
      coverImage: "ftp://example.com/image.png",
      illegalConfirmed: true
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toBe("请输入有效的图片 URL");
    }
  });

  it("创建和编辑项目时会保存封面图字段", () => {
    expect(source("src/app/api/projects/route.ts")).toContain("coverImage: body.coverImage || null");
    expect(source("src/app/api/projects/[id]/route.ts")).toContain("data.coverImage = body.coverImage || null");
    expect(source("src/components/projects/ProjectForm.tsx")).toContain("name=\"coverImage\"");
    expect(source("src/components/projects/ProjectForm.tsx")).toContain("setCoverImage");
  });

  it("项目列表、详情、后台详情和编辑表单使用封面图组件", () => {
    expect(source("src/app/projects/page.tsx")).toContain("<CoverImage src={project.coverImage}");
    expect(source("src/app/projects/[id]/page.tsx")).toContain("<CoverImage src={project.coverImage}");
    expect(source("src/app/admin/projects/[id]/page.tsx")).toContain("<CoverImage src={project.coverImage}");
    expect(source("src/components/projects/ProjectForm.tsx")).toContain("<CoverImage src={coverImage}");
    expect(source("src/components/projects/CoverImage.tsx")).toContain("onError={() => setFailed(true)}");
  });
});

describe("站点图标", () => {
  it("favicon 静态资源存在并在 metadata 中声明", () => {
    expect(existsSync("public/favicon.ico")).toBe(true);
    expect(readFileSync("public/favicon.ico").subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]));
    expect(source("src/app/layout.tsx")).toContain("icon: \"/favicon.ico\"");
  });
});

describe("参与记录数据结构", () => {
  it("包含未中奖参与记录表和中奖回填迁移", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source("prisma/migrations/20260430000100_add_claim_attempts/migration.sql");
    expect(schema).toContain("model ClaimAttempt");
    expect(schema).toContain("result            ClaimAttemptResult");
    expect(schema).toContain("claimModeSnapshot");
    expect(schema).toContain("@@map(\"claim_attempts\")");
    expect(migration).toContain("CREATE TABLE \"claim_attempts\"");
    expect(migration).toContain("'WON'::\"ClaimAttemptResult\"");
    expect(migration).toContain("FROM \"claims\"");
    const snapshotMigration = source("prisma/migrations/20260430000200_add_history_snapshots_and_setting_types/migration.sql");
    expect(snapshotMigration).toContain("claim_mode_snapshot");
    expect(snapshotMigration).toContain("SettingValueType");
  });
});

describe("权限错误码", () => {
  it("后端管理权限不足统一返回 PERMISSION_DENIED", () => {
    const files = [
      "src/lib/auth.ts",
      "src/app/api/projects/[id]/route.ts",
      "src/app/api/projects/[id]/cdks/route.ts",
      "src/app/api/projects/[id]/cdks/import/route.ts",
      "src/app/api/projects/[id]/cdks/export/route.ts",
      "src/app/api/cdks/[id]/route.ts"
    ];
    for (const file of files) {
      expect(source(file)).toContain("PERMISSION_DENIED");
      expect(source(file)).not.toContain("FORBIDDEN");
    }
  });
});

describe("项目领取状态", () => {
  it("关闭、未审核或需登录项目会拒绝领取", () => {
    expect(() =>
      assertProjectClaimable(
        {
          status: "PAUSED",
          reviewStatus: "APPROVED",
          visibility: "PUBLIC",
          requireLogin: false,
          startAt: null,
          endAt: null
        },
        false
      )
    ).toThrow(ApiError);
  });
});

describe("后台中文化和配置开关", () => {
  it("后台关键页面包含中文文案和领取模式说明", () => {
    expect(source("src/app/admin/page.tsx")).toContain("后台仪表盘");
    expect(source("src/components/admin/AdminShell.tsx")).toContain("用户管理");
    expect(source("src/components/admin/AdminShell.tsx")).not.toContain("/admin/turnstile");
    expect(source("src/app/admin/settings/page.tsx")).toContain("关闭后，新用户将无法注册");
    expect(source("src/app/admin/settings/page.tsx")).toContain("留空表示不限制。添加后，仅允许这些邮箱后缀注册。");
    expect(source("src/app/admin/security/page.tsx")).toContain("用于防止机器人自动注册、登录、领取 CDK 或创建项目");
    expect(source("src/components/admin/SettingsPanel.tsx")).toContain("已配置，留空表示保持原值");
    expect(source("src/app/projects/[id]/page.tsx")).toContain("alt={`${project.name}封面图`}");
    expect(source("src/components/projects/ProjectForm.tsx")).toContain("抽奖中奖概率");
    expect(source("src/components/projects/ProjectForm.tsx")).toContain("切换领取模式不会删除历史领取或抽奖记录");
    expect(source("src/components/projects/ProjectForm.tsx")).toContain("历史未中奖记录不会默认视为已领取");
    expect(source("src/app/admin/claims/page.tsx")).toContain("抽奖未中奖");
    expect(source("src/app/admin/projects/[id]/page.tsx")).toContain("最近参与记录");
    expect(claimModeLabel("LOTTERY")).toBe("抽奖模式");
    expect(claimModeDescription("REPEAT")).toContain("用户可以多次领取");
    expect(statusLabel("PENDING")).toBe("待审核");
  });

  it("关闭忘记密码后接口和页面都不可用", () => {
    expect(source("src/app/api/auth/forgot-password/route.ts")).toContain("forgotPassword.enabled");
    expect(source("src/app/api/auth/forgot-password/route.ts")).toContain("管理员已关闭找回密码功能");
    expect(source("src/components/auth/AuthForms.tsx")).toContain("forgotPasswordEnabled");
    expect(source("src/components/auth/AuthForms.tsx")).toContain("找回密码功能已关闭");
  });

  it("关闭注册后无法注册", () => {
    expect(source("src/app/api/auth/register/route.ts")).toContain("管理员已关闭注册");
    expect(source("src/components/auth/AuthForms.tsx")).toContain("当前站点已关闭注册");
  });

  it("注册验证邮件发送失败时不会留下半注册用户", () => {
    const registerRoute = source("src/app/api/auth/register/route.ts");
    const verification = source("src/lib/email-verification.ts");
    const mailer = source("src/lib/mailer.ts");

    expect(registerRoute).toContain("await createPendingEmailVerification({ email, passwordHash })");
    expect(registerRoute).toContain("pendingVerification: true");
    expect(registerRoute).not.toContain("emailVerified: !policy.emailVerification");
    expect(verification).toContain("export async function createPendingEmailVerification");
    expect(verification).toContain("await prisma.pendingEmailVerification.upsert");
    expect(verification).toContain("await sendMail");
    expect(verification).toContain("await prisma.pendingEmailVerification.delete");
    expect(mailer).toContain("SMTP_SEND_FAILED");
    expect(mailer).toContain("configuredFromEmail === \"no-reply@example.com\" ? username");
  });

  it("邮箱验证开启时验证链接通过后才创建正式用户", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source("prisma/migrations/20260504000100_add_pending_email_verifications/migration.sql");
    const verifyRoute = source("src/app/api/auth/verify-email/route.ts");
    const loginRoute = source("src/app/api/auth/login/route.ts");

    expect(schema).toContain("model PendingEmailVerification");
    expect(migration).toContain("CREATE TABLE \"pending_email_verifications\"");
    expect(verifyRoute).toContain("prisma.pendingEmailVerification.findFirst");
    expect(verifyRoute).toContain("tx.user.create");
    expect(verifyRoute).toContain("emailVerified: true");
    expect(verifyRoute).toContain("tx.pendingEmailVerification.delete");
    expect(loginRoute).toContain("prisma.pendingEmailVerification.findUnique");
    expect(loginRoute).toContain("EMAIL_NOT_VERIFIED");
  });

  it("未验证邮箱登录后可以重新发送验证邮件", () => {
    const loginRoute = source("src/app/api/auth/login/route.ts");
    const resendRoute = source("src/app/api/auth/resend-verification/route.ts");
    const authForms = source("src/components/auth/AuthForms.tsx");

    expect(loginRoute).toContain("EMAIL_NOT_VERIFIED");
    expect(resendRoute).toContain("resendPendingVerificationEmail");
    expect(resendRoute).toContain("verifyPassword");
    expect(resendRoute).toContain("pendingEmailVerification");
    expect(resendRoute).toContain("resend-verification-email");
    expect(authForms).toContain("EMAIL_NOT_VERIFIED");
    expect(authForms).toContain("重新发送验证邮件");
    expect(authForms).toContain("/api/auth/resend-verification");
    expect(authForms).toContain("请打开邮箱点击验证链接");
  });
});

describe("默认安装配置", () => {
  it("提供自动生成 .env 的安装脚本且不会提交真实 .env", () => {
    const packageJson = JSON.parse(source("package.json")) as { scripts: Record<string, string> };
    const setupScript = source("scripts/setup-env.js");
    const gitignore = source(".gitignore");

    expect(packageJson.scripts.setup).toBe("node scripts/setup-env.js");
    expect(packageJson.scripts.postinstall).toBe("node scripts/setup-env.js");
    expect(setupScript).toContain("randomBytes");
    expect(setupScript).toContain("writeFileSync(envPath, defaultEnv()");
    expect(setupScript).toContain(".env already exists; keeping existing local configuration.");
    expect(setupScript).toContain("Leave empty to use SMTP_USERNAME as the sender address.");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".env.local");
  });

  it("Docker Compose 有免手写 .env 的安全本地默认值", () => {
    const compose = source("docker-compose.yml");
    expect(compose).toContain("DATABASE_URL: ${DATABASE_URL:-postgresql://cdk:local-cdk-delivery-postgres-password@postgres:5432/cdk_delivery_core?schema=public&connection_limit=3}");
    expect(compose).toContain("JWT_SECRET: ${JWT_SECRET:-local-jwt-secret-change-before-public-use-32chars}");
    expect(compose).toContain("APP_SECRET: ${APP_SECRET:-local-app-secret-change-before-public-use-32chars}");
    expect(compose).toContain("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-local-cdk-delivery-postgres-password}");
  });

  it("部署脚本支持自定义 git 路径和仓库地址", () => {
    const deploy = source("deploy.sh");
    expect(deploy).toContain("REPO_URL=\"${REPO_URL:-https://github.com/xiaoxin-zk/cdk-delivery-core.git}\"");
    expect(deploy).toContain("GIT_BIN=\"${GIT_BIN:-}\"");
    expect(deploy).toContain("find_git()");
    expect(deploy).toContain("prompt_password()");
    expect(deploy).toContain("< /dev/tty");
    expect(deploy).toContain("管理员邮箱 [${DEFAULT_ADMIN_EMAIL}]");
    expect(deploy).toContain("ADMIN_PASSWORD_VALUE=\"$(prompt_password)\"");
    expect(deploy).toContain("\"$GIT\" clone \"$REPO_URL\" \"$INSTALL_DIR\"");
    expect(deploy).toContain("\"$GIT\" pull --ff-only");
  });

  it("Docker 构建显式使用项目依赖里的 esbuild", () => {
    const packageJson = JSON.parse(source("package.json")) as { devDependencies: Record<string, string> };
    expect(packageJson.devDependencies.esbuild).toBe("0.23.1");
    expect(source("Dockerfile")).toContain("RUN ./node_modules/.bin/esbuild scripts/bootstrap-production.ts");
  });

  it("README 说明 npm run setup 自动生成本地配置", () => {
    const readme = source("README.md");
    expect(readme).toContain("npm run setup");
    expect(readme).toContain("`npm install` automatically runs `npm run setup`");
    expect(readme).toContain("without hand-writing a configuration file");
    expect(readme).toContain("交互式要求输入管理员邮箱和管理员密码");
    expect(readme).toContain("prompts for the admin email and password");
  });
});
