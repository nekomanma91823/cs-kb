/**
 * グローバル検索バー。ヘッダーに常駐し、全記事をインクリメンタル検索する。
 *
 * 検索モード:
 *   keyword（デフォルト）: タイトル・本文・タグの部分一致
 *   semantic（⚡ ボタンでトグル）: Embedding によるベクトル検索
 *
 * 設計上の注意:
 *   検索結果はドロップダウンで表示する「コンボボックス」パターン。
 *   クリック外れの検出（clickOutside）でドロップダウンを閉じる。
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Zap } from "lucide-react";
import Link from "next/link";

interface SearchResult {
  id: string;
  title: string;
  tags: string[];
  updatedAt: string;
  score?: number;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&mode=${mode}`
        );
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, mode]);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-colors">
        <Search size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="検索..."
          className="flex-1 bg-transparent text-slate-800 dark:text-slate-200 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none"
        />

        <button
          type="button"
          title={mode === "semantic" ? "意味検索 ON" : "キーワード検索"}
          onClick={() =>
            setMode((m) => (m === "keyword" ? "semantic" : "keyword"))
          }
          className={`shrink-0 transition-colors ${
            mode === "semantic"
              ? "text-purple-500 dark:text-purple-400"
              : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
          }`}
        >
          <Zap size={14} />
        </button>

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1.5 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg dark:shadow-xl z-50 overflow-hidden">
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 px-4 py-3">検索中...</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 px-4 py-3">結果なし</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/entries/${r.id}`}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
                      {r.title}
                    </span>
                    {r.score && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                        {(r.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
