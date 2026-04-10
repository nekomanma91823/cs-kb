/**
 * 次に書くべき記事の AI 提案パネル（Client Component）。
 *
 * Client Component にする理由:
 *   提案の取得は「AI に聞く」ボタンを押したときのみ実行する（オンデマンド）。
 *
 * 設計の判断:
 *   - 初期表示では折り畳み状態にする: ページロードのパフォーマンスと
 *     Gemini API のコスト削減のため
 *   - 「再提案」ボタン: 記事を追加した後に新しい提案を得るために使う
 *   - 「このタイトルで作成」リンク: /entries/new?title=... に遷移し、
 *     EntryForm でタイトルを事前入力する
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Lightbulb, ArrowRight, Loader2, RefreshCw, ChevronDown } from "lucide-react";

interface Suggestion {
  title: string;
  reason: string;
}

export function SuggestionPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function fetchSuggestions() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/suggestions");
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setOpen(true);
      setFetched(true);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    if (!fetched) {
      fetchSuggestions();
    } else {
      setOpen((v) => !v);
    }
  }

  return (
    <div className="mt-8 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={handleToggle}
        disabled={loading}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-100 dark:hover:bg-slate-900/50 disabled:cursor-wait transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-yellow-500 dark:text-yellow-400 shrink-0" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            次に書くべき記事の提案
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            AI
          </span>
        </div>

        {loading ? (
          <Loader2 size={14} className="animate-spin text-slate-400 dark:text-slate-500 shrink-0" />
        ) : (
          <ChevronDown
            size={14}
            className={`text-slate-400 dark:text-slate-600 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && suggestions.length > 0 && (
        <>
          <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/50">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="px-5 py-3.5 flex items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-snug">
                    {s.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 leading-relaxed">
                    {s.reason}
                  </p>
                </div>
                <Link
                  href={`/entries/new?title=${encodeURIComponent(s.title)}`}
                  className="shrink-0 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-0.5 transition-colors whitespace-nowrap"
                >
                  作成 <ArrowRight size={11} />
                </Link>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex justify-end">
            <button
              onClick={fetchSuggestions}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:cursor-wait transition-colors"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              再提案
            </button>
          </div>
        </>
      )}

      {open && fetched && suggestions.length === 0 && (
        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 text-sm text-slate-400 dark:text-slate-500 text-center">
          提案を生成できませんでした
        </div>
      )}
    </div>
  );
}
