import type { UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { inspectSensitiveFields } from "@/lib/security";
import { asBoolean, getSettingsMap } from "@/lib/settings";

type ReviewField = {
  key: "name" | "description" | "content" | "instructions";
  label: string;
  value: string;
  required?: boolean;
  maxLength: number;
};

type ReviewResult = {
  reviewStatus: "APPROVED" | "PENDING" | "REJECTED";
  reviewReason: string | null;
  matchedFields: Array<{ label: string; words: string[] }>;
};

export function projectReviewFields(input: {
  name: string;
  description: string;
  content: string;
  instructions: string;
}): ReviewField[] {
  return [
    { key: "name", label: "项目名称", value: input.name, required: true, maxLength: 120 },
    { key: "description", label: "项目描述", value: input.description, required: true, maxLength: 500 },
    { key: "content", label: "项目内容", value: input.content, required: true, maxLength: 5000 },
    { key: "instructions", label: "使用说明", value: input.instructions, maxLength: 5000 }
  ];
}

export async function reviewProjectSubmission(input: {
  fields: ReviewField[];
  illegalConfirmed: boolean;
  actorRole: UserRole;
}): Promise<ReviewResult> {
  if (!input.illegalConfirmed) {
    throw new ApiError("必须确认项目不涉及违法违规内容", 422, "ILLEGAL_CONFIRMATION_REQUIRED");
  }

  for (const field of input.fields) {
    if (field.required && !field.value.trim()) {
      throw new ApiError(`${field.label}不能为空`, 422, "PROJECT_FIELD_REQUIRED");
    }
    if (field.value.length > field.maxLength) {
      throw new ApiError(`${field.label}长度异常，请缩短后再提交`, 422, "PROJECT_FIELD_TOO_LONG");
    }
  }

  const settings = await getSettingsMap([
    "project.review.enabled",
    "project.review.userRequired",
    "sensitiveWords.enabled",
    "sensitiveWords.mode"
  ]);
  const inspection = await inspectSensitiveFields(
    input.fields.map((field) => ({ label: field.label, text: field.value }))
  );
  const sensitiveReason = formatSensitiveReason(inspection.matchedFields);

  if (inspection.matched.length > 0 && inspection.mode === "block") {
    return {
      reviewStatus: "REJECTED",
      reviewReason: `自动审查拒绝：${sensitiveReason}`,
      matchedFields: inspection.matchedFields
    };
  }

  if (inspection.matched.length > 0) {
    return {
      reviewStatus: "PENDING",
      reviewReason: `命中敏感词：${sensitiveReason}`,
      matchedFields: inspection.matchedFields
    };
  }

  if (asBoolean(settings.get("project.review.enabled"))) {
    return {
      reviewStatus: "PENDING",
      reviewReason: "后台已开启项目审核，等待管理员审核。",
      matchedFields: []
    };
  }

  if (input.actorRole === "USER" && asBoolean(settings.get("project.review.userRequired"))) {
    return {
      reviewStatus: "PENDING",
      reviewReason: "普通用户项目需要管理员人工审核。",
      matchedFields: []
    };
  }

  return {
    reviewStatus: "APPROVED",
    reviewReason: null,
    matchedFields: []
  };
}

export function formatSensitiveReason(matches: Array<{ label: string; words: string[] }>) {
  return matches
    .map((match) => `${match.label}：${match.words.join("、")}`)
    .join("；");
}

export function extractReviewMatchedFields(reason: string | null | undefined) {
  if (!reason) return [];
  const fields = ["项目名称", "项目描述", "项目内容", "使用说明"];
  return fields.filter((field) => reason.includes(`${field}：`));
}
