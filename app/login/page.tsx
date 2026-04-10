/**
 * ログインページ。
 *
 * 認証方式: メール + パスワード（signInWithPassword）
 *   Magic Link から切り替えた理由:
 *   - Supabase 無料プランのメール送信レート制限（数通/時間）に引っかかるため
 *   - 個人利用では毎回メールを確認するより、パスワードを入力する方が速い
 *   - セッションは Cookie で永続化されるため、頻繁なログインは不要
 *
 * セキュリティ:
 *   - クライアント側でメールアドレスをチェックし、権限外アドレスの
 *     Supabase へのリクエストを事前に防ぐ
 *   - Supabase 側でパスワードのハッシュ化・照合を行う（bcrypt）
 *   - セッションは HttpOnly Cookie で管理（XSS 対策）
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Network, Loader2, Lock } from "lucide-react";

const WRITER_EMAIL = "taku1899neko@gmail.com";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const urlError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    urlError === "unauthorized" ? "アクセス権限がありません" : ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: WRITER_EMAIL,
      password,
    });

    if (authError) {
      // "Invalid login credentials" など Supabase のエラーメッセージを日本語化
      setError("パスワードが正しくありません");
    } else {
      // ログイン成功: router.push だけでは Server Component が再レンダリングされない。
      // refresh() でレイアウトのキャッシュを破棄し、認証状態を反映させる。
      router.push(next);
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <Network size={24} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100">cs-kb</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              ログイン
            </h1>
            <p className="text-sm text-slate-500 font-mono truncate">
              {WRITER_EMAIL}
            </p>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5"
            >
              パスワード
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600"
              />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Lock size={15} />
            )}
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
