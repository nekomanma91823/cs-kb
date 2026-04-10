/**
 * GET /api/auth/callback
 *
 * Supabase の PKCE フロー（Proof Key for Code Exchange）のコールバックエンドポイント。
 *
 * マジックリンクのフロー:
 *   1. ユーザーがメール内のリンクをクリック
 *   2. Supabase が ?code=xxx&next=yyy を付けてこの URL にリダイレクト
 *   3. exchangeCodeForSession(code) でコードをアクセストークンに交換
 *   4. セッション Cookie が設定され、next の URL にリダイレクト
 *
 * PKCE を使う理由:
 *   SPAや Server-Side Rendering では暗黙的フロー（access_token をハッシュで受け取る）より
 *   PKCE の方が安全。コードは短命（数分）で一度しか使えない。
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { WRITER_EMAIL } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // セッション確立後にメールアドレスを検証する。
      // クライアント側のチェック（login/page.tsx）は JS 改ざんで迂回できるため、
      // サーバー側のこのチェックが実質的な最終防衛線になる。
      // 権限のないユーザーのセッションは即座にサインアウトして Cookie を破棄する。
      if (data.user?.email !== WRITER_EMAIL) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL("/login?error=unauthorized", req.url)
        );
      }

      return NextResponse.redirect(new URL(next, req.url));
    }
  }

  // コードが無いか、交換に失敗した場合はエラー付きでログインページへ
  return NextResponse.redirect(new URL("/login?error=auth_error", req.url));
}
