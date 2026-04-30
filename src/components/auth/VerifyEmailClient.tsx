"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/components/api";
import { Card } from "@/components/ui";

export function VerifyEmailClient() {
  const params = useSearchParams();
  const [message, setMessage] = useState("正在验证邮箱...");

  useEffect(() => {
    api("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: params.get("token") ?? "" })
    })
      .then(() => setMessage("邮箱验证成功，现在可以登录。"))
      .catch((err) => setMessage(err instanceof Error ? err.message : "验证失败"));
  }, [params]);

  return (
    <main className="mx-auto grid min-h-[calc(100vh-140px)] max-w-md place-items-center px-4 py-12">
      <Card className="w-full p-6">
        <h1 className="mb-3 text-2xl font-semibold">邮箱验证</h1>
        <p className="text-sm text-ink/70">{message}</p>
        <Link className="mt-5 inline-flex rounded bg-ink px-4 py-2 text-sm text-white" href="/login">
          去登录
        </Link>
      </Card>
    </main>
  );
}
