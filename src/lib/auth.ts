import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { requireSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE = "cdkdc_session";

function isSecureCookie() {
  const url = process.env.APP_URL ?? "";
  return url.startsWith("https://");
}

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  emailVerified: boolean;
};

type SessionPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export function createSessionToken(user: AuthUser, remember = false) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    } satisfies SessionPayload,
    requireSecret("JWT_SECRET"),
    { expiresIn: remember ? "30d" : "8h" }
  );
}

export function setAuthCookie(response: NextResponse, token: string, remember = false) {
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, requireSecret("JWT_SECRET")) as SessionPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true
      }
    });

    if (!user || user.status !== "ACTIVE") return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("请先登录", 401, "UNAUTHORIZED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError("需要管理员权限", 403, "PERMISSION_DENIED");
  return user;
}

export function canManageProject(user: AuthUser, ownerId: string) {
  return user.role === "ADMIN" || user.id === ownerId;
}
