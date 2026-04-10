/**
 * 日付フォーマットユーティリティ。
 *
 * date-fns などのライブラリを使わず自前実装している理由:
 *   - 必要な機能が「相対時間」と「和暦フォーマット」の 2 関数だけ
 *   - バンドルサイズへの影響をゼロにしたい
 *   - Intl.DateTimeFormat（ブラウザ/Node 標準）で日本語出力が得られる
 */

/**
 * 指定日時から現在までの経過時間を「〇分前」形式の日本語で返す。
 *
 * 各段階の閾値:
 *   60 秒未満      → 「たった今」（秒単位は細かすぎてノイズ）
 *   60 分未満      → 分単位
 *   24 時間未満    → 時間単位
 *   30 日未満      → 日単位（1 ヶ月 ≈ 30 日の概算）
 *   12 ヶ月未満    → 月単位
 *   それ以上       → 年単位
 *
 * 引数が string の場合は new Date() で変換する。
 * Prisma が返す DateTime は JSON シリアライズ後に ISO 文字列になるため、
 * Server Component から Client Component へ渡した後も安全に扱える。
 */
export function formatDistanceToNow(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return "たった今";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);
  // 30 日を 1 ヶ月の基準にしている（月ごとの日数差を無視した簡易計算）
  if (days < 30) return `${days}日前`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}ヶ月前`;

  return `${Math.floor(months / 12)}年前`;
}

/**
 * 日付を「2025年4月9日」のような日本語ロング形式にフォーマットする。
 *
 * Intl.DateTimeFormat を使う理由:
 *   - ブラウザ・Node.js どちらでも動作する標準 API
 *   - locale を "ja-JP" にするだけで日本語の月名・曜日が自動で得られる
 *   - month: "long" → 「4月」（short だと「4」など環境依存）
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
