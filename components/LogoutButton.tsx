/**
 * ログアウトボタン（Client Component）。
 *
 * Client Component にする理由:
 *   signOut() は Supabase のブラウザクライアントを使う非同期操作。
 *   Server Component では実行できない（サーバーサイドにクライアントセッションがない）。
 *
 * ログアウト後に router.refresh() を呼ぶ理由:
 *   Server Component のキャッシュを無効化し、ヘッダー等の認証状態の表示を更新するため。
 *   router.push("/") だけでは Server Component が再レンダリングされない。
 */

"use client";

import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh(); // Server Component を再レンダリングしてナビゲーションを更新
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
      title="ログアウト"
    >
      <LogOut size={12} />
      ログアウト
    </button>
  );
}
