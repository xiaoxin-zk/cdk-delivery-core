"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";

const links = [
  ["/admin", "仪表盘"],
  ["/admin/users", "用户管理"],
  ["/admin/projects", "项目管理"],
  ["/admin/cdks", "CDK 管理"],
  ["/admin/claims", "领取记录"],
  ["/admin/reviews", "审核管理"],
  ["/admin/settings", "系统设置"],
  ["/admin/security", "安全设置"],
  ["/admin/email", "邮件设置"],
  ["/admin/audit-logs", "审计日志"]
];

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
      <div className="lg:hidden">
        <Button variant="secondary" onClick={() => setOpen((value) => !value)}>
          <Menu className="mr-2 h-4 w-4" />
          后台导航
        </Button>
      </div>
      <aside className={`${open ? "block" : "hidden"} h-fit rounded-lg border border-line bg-white p-3 lg:block`}>
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink/50">{email}</p>
        <nav className="grid gap-1">
          {links.map(([href, label]) => (
            <Link key={href} className="rounded px-3 py-2 text-sm hover:bg-paper" href={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">{children}</section>
    </main>
  );
}
