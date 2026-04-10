import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isWriter, getServerUser } from "@/lib/auth";
import { Network, BookOpen, Plus, LogIn } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "cs-kb — Knowledge Base",
  description: "技術知識のグラフベース管理システム",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [writer, user] = await Promise.all([isWriter(), getServerUser()]);

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
        {/*
         * FOUC（Flash of Unstyled Content）防止スクリプト。
         *
         * なぜ dangerouslySetInnerHTML のインラインスクリプトか:
         *   Next.js の Script コンポーネントは非同期で読み込まれるため、
         *   最初のペイント前にテーマを適用できない。
         *   インラインスクリプトは HTML パース中に同期実行されるため、
         *   ページが描画される前に <html class="dark"> を設定できる。
         *
         * スクリプトを最小化している理由:
         *   <head> のブロッキングスクリプトはページ表示を遅らせるため、
         *   可能な限り短くする（localStorage の読み取りと classList 操作のみ）。
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark')})()`,
          }}
        />
      </head>
      <body className="h-full flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <Link href="/" className="flex items-center gap-2 group">
              <Network size={20} className="text-blue-500 dark:text-blue-400" />
              <span className="font-bold text-slate-900 dark:text-slate-100 text-lg tracking-tight">
                cs-kb
              </span>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <NavLink href="/" icon={<Network size={16} />} label="グラフビュー" />
            <NavLink href="/entries" icon={<BookOpen size={16} />} label="記事一覧" />
            {writer && (
              <NavLink
                href="/entries/new"
                icon={<Plus size={16} />}
                label="新規作成"
                highlight
              />
            )}
          </nav>

          <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2">
            {user ? (
              <>
                <p className="text-slate-400 dark:text-slate-600 truncate" title={user.email ?? ""}>
                  {user.email}
                </p>
                <LogoutButton />
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <LogIn size={12} />
                ログイン
              </Link>
            )}
            <ThemeToggle />
          </div>
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 shrink-0 flex items-center px-5 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur">
            <SearchBar />
          </header>
          <main className="flex-1 min-h-0 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}

function NavLink({
  href,
  icon,
  label,
  highlight = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        highlight
          ? "bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-600/30"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
