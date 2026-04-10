/**
 * テーマ（ライト/ダーク）の検出フック。
 *
 * なぜ CSS の prefers-color-scheme だけに頼らないか:
 *   ユーザーが手動でテーマを切り替えられるようにするため、
 *   <html class="dark"> の有無で判定する。
 *
 * MutationObserver を使う理由:
 *   ThemeToggle が classList を変更した瞬間に再レンダリングが必要なコンポーネント
 *   （MarkdownRenderer の SyntaxHighlighter など）に変更を伝えるため。
 *   localStorage の変更は同一タブ内では storage イベントが発火しないので
 *   MutationObserver の方が確実。
 *
 * "use client" が必要な理由:
 *   document.documentElement へのアクセスはブラウザ API のため。
 */

"use client";

import { useEffect, useState } from "react";

export function useTheme(): boolean {
  // SSR では document が存在しないため false で初期化
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const html = document.documentElement;

    // 初期値を読み取る
    setIsDark(html.classList.contains("dark"));

    // classList の変更を監視する
    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains("dark"));
    });
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class"], // class 属性の変更のみ監視（パフォーマンス最適化）
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}
