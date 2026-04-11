"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Network, BookOpen, Plus, LogIn } from "lucide-react";
import { LogoutButton } from "./LogoutButton";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  writer: boolean;
  user: { email?: string | null } | null;
}

export function MobileMenu({ writer, user }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden p-2 -ml-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        aria-label="メニューを開く"
      >
        <Menu size={20} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={close}
            aria-hidden="true"
          />

          {/* Drawer */}
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 z-50 flex flex-col md:hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <Link href="/" onClick={close} className="flex items-center gap-2">
                <Network size={20} className="text-blue-500 dark:text-blue-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-lg tracking-tight">
                  cs-kb
                </span>
              </Link>
              <button
                type="button"
                onClick={close}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                aria-label="メニューを閉じる"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              <DrawerLink href="/" icon={<Network size={16} />} label="グラフビュー" onClick={close} />
              <DrawerLink href="/entries" icon={<BookOpen size={16} />} label="記事一覧" onClick={close} />
              {writer && (
                <DrawerLink
                  href="/entries/new"
                  icon={<Plus size={16} />}
                  label="新規作成"
                  highlight
                  onClick={close}
                />
              )}
            </nav>

            <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2">
              {user ? (
                <>
                  <p
                    className="text-slate-400 dark:text-slate-600 truncate"
                    title={user.email ?? ""}
                  >
                    {user.email}
                  </p>
                  <LogoutButton />
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={close}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  <LogIn size={12} />
                  ログイン
                </Link>
              )}
              <ThemeToggle />
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function DrawerLink({
  href,
  icon,
  label,
  highlight = false,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
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
