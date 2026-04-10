/**
 * Next.js ミドルウェア — セッション更新 + 書き込みルート保護。
 *
 * 2 つの役割:
 *   1. Supabase のセッション Cookie をリクエストごとに更新する
 *      （アクセストークンは有効期限があるため、ミドルウェアで自動リフレッシュが必要）
 *   2. 書き込みページ（/entries/new、/entries/[id]/edit）を
 *      ライター以外からアクセスされた場合に /login へリダイレクトする
 *
 * supabaseResponse の取り扱い:
 *   Supabase SSR は Cookie の読み書きを通じてセッションを管理する。
 *   setAll コールバック内で supabaseResponse を更新することで、
 *   レスポンスに新しい Cookie が乗る。
 *   独自の NextResponse を返す場合も、この Cookie をコピーする必要がある
 *   （コピーしないとセッションが失われる）。
 *
 * matcher の設計:
 *   _next/static などの静的ファイルを除外している理由:
 *   ミドルウェアを静的ファイルに対して実行するとパフォーマンスが低下するため。
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { WRITER_EMAIL } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  // supabaseResponse は mutable。setAll コールバック内で再代入される。
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // request に Cookie をセットした上で新しい NextResponse を作る。
          // この二段階が必要な理由:
          //   Next.js のミドルウェアでは request と response の両方に
          //   Cookie を設定する必要がある（Supabase SSR ドキュメント参照）。
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() でセッションを検証・更新する。
  // getSession() ではなく getUser() を使う理由:
  //   getSession() は Cookie の値をそのまま信頼するが、
  //   getUser() はサーバー側でトークンを検証するためセキュア。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 書き込みページのパス判定
  // /entries/new または /entries/*/edit にマッチする
  const isWritePath =
    pathname === "/entries/new" ||
    /^\/entries\/[^/]+\/edit$/.test(pathname);

  if (isWritePath && user?.email !== WRITER_EMAIL) {
    // 未認証またはライター以外は /login へリダイレクト
    // next パラメータにリダイレクト先を埋め込み、ログイン後に元のページへ戻れるようにする
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);

    // リダイレクトレスポンスにも Supabase の Cookie をコピーする（セッション保持のため）
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // 静的アセット・画像最適化・favicon を除く全リクエストに適用
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
