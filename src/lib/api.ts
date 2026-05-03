import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "BAD_REQUEST"
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status, headers: JSON_HEADERS });
}

export function fail(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ ok: false, message, code, error: { message, code } }, { status, headers: JSON_HEADERS });
}

export async function route(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.status, error.code);
    }
    if (error instanceof ZodError) {
      return fail(error.issues[0]?.message ?? "请求参数不合法", 422, "VALIDATION_ERROR");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("该记录已存在（唯一约束冲突）", 409, "DUPLICATE");
    }
    console.error("unhandled api error", error instanceof Error ? error.name : typeof error);
    return fail("服务器暂时无法处理请求", 500, "INTERNAL_ERROR");
  }
}
