export const CLAIM_MODE_LABELS = {
  LOTTERY: "抽奖模式",
  ONCE: "每人一次",
  REPEAT: "可重复领取"
} as const;

export const CLAIM_MODE_DESCRIPTIONS = {
  LOTTERY: "用户点击抽奖后，系统会先按中奖概率判定，中奖后从剩余 CDK 中随机发放一个。未中奖也会记录一次参与。",
  ONCE: "每个登录用户只能领取一次该项目的 CDK。",
  REPEAT: "用户可以多次领取，但会受到项目领取限制约束。"
} as const;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLIC: "公开",
  PAUSED: "已暂停",
  ENDED: "已结束",
  DISABLED: "已禁用",
  PRIVATE: "私有",
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  ACTIVE: "正常",
  DELETED: "已删除",
  AVAILABLE: "未领取",
  CLAIMED: "已领取",
  USER: "普通用户",
  ADMIN: "管理员",
  VERIFY_EMAIL: "邮箱验证",
  RESET_PASSWORD: "重置密码"
};

const CLAIM_ATTEMPT_RESULT_LABELS: Record<string, string> = {
  WON: "抽奖中奖",
  LOST: "抽奖未中奖"
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "admin.user.update": "管理员更新用户",
  "admin.user.soft_delete": "管理员软删除用户",
  "admin.project.update": "管理员更新项目",
  "admin.project.delete": "管理员删除项目",
  "admin.settings.update": "管理员更新系统设置"
};

const AUDIT_TARGET_LABELS: Record<string, string> = {
  user: "用户",
  project: "项目",
  settings: "系统设置"
};

export function claimModeLabel(mode: string) {
  return CLAIM_MODE_LABELS[mode as keyof typeof CLAIM_MODE_LABELS] ?? mode;
}

export function claimModeDescription(mode: string) {
  return CLAIM_MODE_DESCRIPTIONS[mode as keyof typeof CLAIM_MODE_DESCRIPTIONS] ?? "";
}

export function claimRuleDescription(project: { claimMode: string; perUserLimit?: number | null }) {
  if (project.claimMode === "LOTTERY") {
    if (project.perUserLimit === 1) {
      return "抽奖规则：每个用户只能参与一次。未中奖也会消耗参与机会。";
    }
    return "抽奖规则：用户可以重复参与，直到达到项目设置的参与次数限制。";
  }
  if (project.claimMode === "ONCE") return "领取规则：每个用户只能领取一次。";
  return "领取规则：系统会从剩余 CDK 中随机发放一个。";
}

export function statusLabel(value: string) {
  return STATUS_LABELS[value] ?? value;
}

export function claimAttemptResultLabel(value?: string | null) {
  return value ? CLAIM_ATTEMPT_RESULT_LABELS[value] ?? "历史状态未知" : "历史状态未知";
}

export function auditActionLabel(value: string) {
  return AUDIT_ACTION_LABELS[value] ?? value;
}

export function auditTargetLabel(value: string) {
  return AUDIT_TARGET_LABELS[value] ?? value;
}

export function booleanLabel(value: boolean) {
  return value ? "是" : "否";
}

export function dateTimeLabel(value: Date | string | null | undefined) {
  if (!value) return "不限制";
  return new Date(value).toLocaleString("zh-CN");
}

export function limitLabel(value: number | null | undefined, unit = "次") {
  return value ? `${value}${unit}` : "不限制";
}
