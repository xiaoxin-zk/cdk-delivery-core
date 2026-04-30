import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api";

export async function readJson<T = unknown>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("请求体必须是合法 JSON", 400, "INVALID_JSON");
  }
}

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent") ?? "";
}
