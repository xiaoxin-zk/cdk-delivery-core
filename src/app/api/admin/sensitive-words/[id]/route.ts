import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const patchSchema = z.object({
  word: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional()
});

export function PATCH(request: NextRequest, { params }: Params) {
  return route(async () => {
    await requireAdmin();
    const body = patchSchema.parse(await request.json());
    const word = await prisma.sensitiveWord.update({
      where: { id: params.id },
      data: body
    });
    return ok({ word });
  });
}

export function DELETE(_request: NextRequest, { params }: Params) {
  return route(async () => {
    await requireAdmin();
    await prisma.sensitiveWord.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  });
}
