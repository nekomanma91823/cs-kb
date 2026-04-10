/**
 * 認証ユーティリティ。
 *
 * WRITER_EMAIL: 書き込み権限を持つ唯一のユーザー。
 *   ハードコードにしている理由:
 *   - 個人知識ベースとして設計されており、複数ライターを想定していない
 *   - DB に権限テーブルを作るよりシンプルで、変更頻度も極めて低い
 *
 * requireWriter の戻り値パターン:
 *   - null: 認証OK（呼び出し元は処理を続行する）
 *   - NextResponse: 認証エラー（401 を即座に返す）
 *   この「null or Response」パターンにより、API ルートで if 文 1 行でガードできる:
 *   ```
 *   const err = await requireWriter();
 *   if (err) return err;
 *   ```
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const WRITER_EMAIL = "taku1899neko@gmail.com";

/** 現在ログイン中のユーザーを返す。未ログインの場合は null。 */
export async function getServerUser() {
  // getUser() は JWT の署名検証をサーバー側で行う（セキュアな実装）。
  // getSession() はクライアントから送られた Cookie をそのまま信頼するため
  // セキュリティ上 getUser() を優先する（Supabase の推奨）。
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** ログイン中のユーザーが書き込み権限を持つか判定する。 */
export async function isWriter(): Promise<boolean> {
  const user = await getServerUser();
  return user?.email === WRITER_EMAIL;
}

/**
 * API ルート用ガード関数。
 * 書き込み権限がなければ 401 レスポンスを返し、あれば null を返す。
 */
export async function requireWriter(): Promise<NextResponse | null> {
  if (!(await isWriter())) {
    return NextResponse.json(
      { error: "この操作には認証が必要です" },
      { status: 401 }
    );
  }
  return null;
}
