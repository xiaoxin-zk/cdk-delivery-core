import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { assertUserClaimQuota, resolveClaimIdentity } from "@/lib/claim-policy";
import { projectSchema, projectUpdateSchema } from "@/lib/validators";

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

describe("perUserLimit single-identity claim limits", () => {
  it("allows the first two REPEAT claims with perUserLimit=2 and blocks the third", () => {
    expect(() => assertUserClaimQuota({ claimMode: "REPEAT", existingClaims: 0, perUserLimit: 2 })).not.toThrow();
    expect(() => assertUserClaimQuota({ claimMode: "REPEAT", existingClaims: 1, perUserLimit: 2 })).not.toThrow();
    expectApiError(
      () => assertUserClaimQuota({ claimMode: "REPEAT", existingClaims: 2, perUserLimit: 2 }),
      "USER_LIMIT_REACHED",
      "你的领取次数已达上限。"
    );
  });

  it("does not limit REPEAT claims when perUserLimit is not configured", () => {
    expect(() => assertUserClaimQuota({ claimMode: "REPEAT", existingClaims: 25, perUserLimit: null })).not.toThrow();
    expect(() => assertUserClaimQuota({ claimMode: "REPEAT", existingClaims: 25, perUserLimit: undefined })).not.toThrow();
    expect(() => assertUserClaimQuota({ claimMode: "REPEAT", existingClaims: 25, perUserLimit: 0 })).not.toThrow();
  });

  it("blocks a second LOTTERY attempt with perUserLimit=1 after one lost attempt", () => {
    expectApiError(
      () => assertUserClaimQuota({ claimMode: "LOTTERY", existingClaims: 0, existingAttempts: 1, perUserLimit: 1 }),
      "ALREADY_PARTICIPATED",
      "你已经参与过该项目抽奖，不能重复参与。"
    );
  });

  it("blocks a third LOTTERY attempt with perUserLimit=2 after two attempts", () => {
    expectApiError(
      () => assertUserClaimQuota({ claimMode: "LOTTERY", existingClaims: 1, existingAttempts: 2, perUserLimit: 2 }),
      "USER_LIMIT_REACHED",
      "你的领取次数已达上限。"
    );
  });

  it("blocks a second ONCE claim after an existing successful claim", () => {
    expectApiError(
      () => assertUserClaimQuota({ claimMode: "ONCE", existingClaims: 1, existingAttempts: 0, perUserLimit: null }),
      "ALREADY_CLAIMED",
      "你已经领取过该项目的 CDK，不能重复领取。"
    );
  });

  it("uses trimmed anonymous emailOrIdentifier as the limiting identity", () => {
    expect(resolveClaimIdentity({ emailOrIdentifier: " user@example.com " })).toEqual({
      emailOrIdentifier: "user@example.com"
    });
    expect(resolveClaimIdentity({ emailOrIdentifier: "other@example.com" })).toEqual({
      emailOrIdentifier: "other@example.com"
    });
    expectApiError(() => resolveClaimIdentity({ emailOrIdentifier: "   " }), "IDENTIFIER_REQUIRED");
  });

  it("keeps anonymous identities independent in claim queries and does not use IP as the primary identity", () => {
    const claimSource = source("src/lib/claims.ts");
    expect(claimSource).toContain("resolveClaimIdentity");
    expect(claimSource).toContain("...identityWhere");
    expect(claimSource).toContain("emailOrIdentifier: claimIdentifier");
    expect(claimSource).not.toContain("emailOrIdentifier: input.ip");
  });

  it("keeps perUserLimit through validators and the project form payload", () => {
    expect(
      projectSchema.parse({
        name: "限制项目",
        description: "验证 perUserLimit",
        content: "项目内容",
        claimMode: "REPEAT",
        perUserLimit: "2",
        illegalConfirmed: true
      }).perUserLimit
    ).toBe(2);
    expect(projectUpdateSchema.parse({ perUserLimit: null }).perUserLimit).toBeNull();
    expect(projectSchema.parse({
      name: "空限制项目",
      description: "验证空 perUserLimit",
      content: "项目内容",
      claimMode: "REPEAT",
      perUserLimit: "",
      illegalConfirmed: true
    }).perUserLimit).toBeNull();

    const formSource = source("src/components/projects/ProjectForm.tsx");
    expect(formSource).toContain('perUserLimit: numberValue(formData, "perUserLimit")');
    expect(formSource).toContain('name="perUserLimit"');
    expect(formSource).not.toContain("participationLimit");
  });

  it("disables retry with accurate terminal copy in ClaimPanel", () => {
    const panelSource = source("src/components/projects/ClaimPanel.tsx");
    expect(panelSource).toContain("CLAIM_ERROR_TEXT");
    expect(panelSource).toContain("getLocalLimitState");
    expect(panelSource).toContain("normalizedLimit");
    expect(panelSource).toContain("if (!normalizedLimit || nextUsageCount < normalizedLimit) return null;");
    expect(panelSource).toContain("ALREADY_PARTICIPATED");
    expect(panelSource).toContain("ALREADY_CLAIMED");
    expect(panelSource).toContain("USER_LIMIT_REACHED");
    expect(panelSource).toContain('type="submit" disabled={loading || Boolean(terminalReason)}');
  });
});
