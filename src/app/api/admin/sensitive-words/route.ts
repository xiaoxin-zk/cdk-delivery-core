import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError, ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getPagination, pageResult } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { splitListInput } from "@/lib/validators";

export const dynamic = "force-dynamic";

const schema = z.object({
  word: z.string().trim().max(120).optional(),
  text: z.string().max(20000).optional(),
  enabled: z.boolean().optional()
});

export function GET(request: NextRequest) {
  return route(async () => {
    await requireAdmin();
    const { page, pageSize, skip, take } = getPagination(request);
    const search = new URL(request.url).searchParams.get("search")?.trim();
    const where: Prisma.SensitiveWordWhereInput = search
      ? { word: { contains: search, mode: "insensitive" } }
      : {};
    const [items, total] = await Promise.all([
      prisma.sensitiveWord.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.sensitiveWord.count({ where })
    ]);
    return ok(pageResult(items, total, page, pageSize));
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    await requireAdmin();
    const body = schema.parse(await request.json());
    const source = body.text ?? body.word ?? "";
    const words = [...new Set(splitListInput(source).map((word) => word.trim()).filter(Boolean))];
    if (words.length === 0) throw new ApiError("请输入敏感词", 422, "SENSITIVE_WORD_REQUIRED");
    if (words.some((word) => word.length > 120)) throw new ApiError("单个敏感词不能超过 120 个字符", 422, "SENSITIVE_WORD_TOO_LONG");

    const result = await prisma.sensitiveWord.createMany({
      data: words.map((word) => ({ word, enabled: body.enabled ?? true })),
      skipDuplicates: true
    });
    return ok({ imported: result.count }, 201);
  });
}
