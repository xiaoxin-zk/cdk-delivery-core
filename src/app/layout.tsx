import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { getPublicSettings } from "@/lib/settings";
import { LogOutButton } from "@/components/auth/LogOutButton";

export const metadata: Metadata = {
  title: "CDK Delivery Core",
  description: "合法 CDK、授权码、兑换码分发管理平台",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico"
  }
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, user] = await Promise.all([getPublicSettings(), getCurrentUser()]);

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className="font-sans">
        <div className="min-h-screen bg-paper">
          <header className="sticky top-0 z-40 border-b border-line bg-paper/92 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded bg-ink text-sm font-bold text-white">CDK</span>
                <span className="font-semibold">{settings.siteName}</span>
              </Link>
              <nav className="flex items-center gap-2 text-sm">
                <Link className="rounded px-3 py-2 hover:bg-white" href="/projects">
                  项目
                </Link>
                {user ? (
                  <>
                    <Link className="rounded px-3 py-2 hover:bg-white" href="/dashboard">
                      控制台
                    </Link>
                    {user.role === "ADMIN" ? (
                      <Link className="rounded px-3 py-2 hover:bg-white" href="/admin">
                        后台
                      </Link>
                    ) : null}
                    <LogOutButton />
                  </>
                ) : (
                  <>
                    <Link className="rounded px-3 py-2 hover:bg-white" href="/login">
                      登录
                    </Link>
                    {settings.registrationEnabled ? (
                      <Link className="rounded bg-ink px-3 py-2 text-white" href="/register">
                        注册
                      </Link>
                    ) : null}
                  </>
                )}
              </nav>
            </div>
          </header>
          {children}
          <footer className="border-t border-line px-4 py-8 text-center text-sm text-ink/60">
            {settings.footerText}
          </footer>
        </div>
      </body>
    </html>
  );
}
