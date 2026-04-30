import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { clearAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function POST() {
  return route(async () => {
    const response = NextResponse.json({ ok: true, data: { loggedOut: true } });
    clearAuthCookie(response);
    return response;
  });
}
