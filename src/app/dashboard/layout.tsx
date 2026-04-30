import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const links = [
  { href: "/dashboard", label: "概览" },
  { href: "/dashboard/projects", label: "我的项目" },
  { href: "/dashboard/projects/new", label: "创建项目" },
  { href: "/dashboard/claims", label: "领取记录" },
  { href: "/dashboard/settings", label: "账号设置" }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
      <aside className="h-fit rounded-lg border border-line bg-white p-3">
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink/50">{user.email}</p>
        <nav className="grid gap-1">
          {links.map((link) => (
            <Link key={link.href} className="rounded px-3 py-2 text-sm hover:bg-paper" href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section>{children}</section>
    </main>
  );
}
