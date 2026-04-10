/**
 * ブラウザ用 Supabase クライアントファクトリ。
 *
 * createBrowserClient はシングルトンを自動管理するため、
 * 毎回呼び出しても同一インスタンスを返す。
 * Server Component では使用不可（ブラウザ環境専用）。
 *
 * 使用箇所: Client Component でのログイン・ログアウト処理
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
