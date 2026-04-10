/**
 * サーバーサイド用 Supabase クライアントファクトリ。
 *
 * createServerClient を毎回作る理由:
 *   Next.js の Server Component / Route Handler はリクエストごとに実行されるため、
 *   シングルトンにすると Cookie が共有されてしまう。
 *   cookies() は非同期 API（Next.js 16 の変更）なので await が必要。
 *
 * setAll が try/catch で囲まれている理由:
 *   Server Component の render 中は cookies().set() が禁止されており、
 *   ミドルウェアのみが Cookie をセットできる。
 *   Route Handler では set できるが、render 中は読み取り専用になる。
 *   エラーを無視することで両環境で同じコードが使える（セッション更新は
 *   middleware.ts が担う）。
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component の render 中は set 禁止。無視して続行。
          }
        },
      },
    }
  );
}
