import type { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  actor?: AuthUser | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.id,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata,
        ip: input.ip,
        userAgent: input.userAgent
      }
    });
  } catch (error) {
    console.error("audit log failed", error instanceof Error ? error.name : typeof error);
  }
}
