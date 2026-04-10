/**
 * ライト/ダークモード切り替えボタン（Client Component）。
 *
 * 状態管理の設計:
 *   - localStorage: "theme" キーで "light" / "dark" を保持（ページリロード後も維持）
 *   - <html class="dark">: Tailwind の dark: variant を有効化するトリガー
 *   - React state (isDark): ボタンアイコン切り替えのための UI 状態
 *
 * デフォルトをライトにする理由:
 *   localStorage に何も保存されていない初回アクセスはライトモードで表示する。
 *   システムの prefers-color-scheme に追従させたい場合は
 *   `!saved && window.matchMedia("(prefers-color-scheme: dark)").matches`
 *   のチェックを追加すれば良い。
 *
 * FOUC（Flash of Unstyled Content）について:
 *   このコンポーネントは useEffect でテーマを適用するため、
 *   ハイドレーション前の一瞬ライトモードで表示される可能性がある。
 *   app/layout.tsx の <head> にインラインスクリプトを置いて防いでいる。
 */

"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // localStorage から保存済みテーマを読み込み、<html> クラスに反映
    const saved = localStorage.getItem("theme");
    const dark = saved === "dark"; // 未設定はライトがデフォルト
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
    >
      {isDark ? <Sun size={12} /> : <Moon size={12} />}
      {isDark ? "ライト" : "ダーク"}
    </button>
  );
}
