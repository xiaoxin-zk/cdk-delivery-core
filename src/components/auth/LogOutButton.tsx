"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogOutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button className="rounded p-2 hover:bg-white" title="退出登录" onClick={logout}>
      <LogOut className="h-4 w-4" />
    </button>
  );
}
