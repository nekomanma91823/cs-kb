/**
 * 辞書パネルコンポーネント（Client Component）。
 *
 * 用語の検索・閲覧・追加・編集・削除を一つのパネルで行う。
 * isWriter=false の場合は閲覧・検索のみ可能（追加・編集・削除UI を非表示）。
 *
 * 検索は aliases（別名）にもヒットする。
 * 例: 「SGD」で検索すると「確率的勾配降下法」がヒットする。
 */

"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, Check, X } from "lucide-react";

interface Term {
  id: string;
  term: string;
  definition: string;
  aliases: string[];
}

interface Props {
  isWriter: boolean;
}

const EMPTY_FORM = { term: "", definition: "", aliases: "" };

export function GlossaryPanel({ isWriter }: Props) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Term | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/glossary")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTerms(Array.isArray(data) ? data : []));
  }, []);

  const filtered = terms.filter(
    (t) =>
      t.term.toLowerCase().includes(query.toLowerCase()) ||
      t.aliases.some((a) => a.toLowerCase().includes(query.toLowerCase()))
  );

  function startAdd() {
    setAdding(true);
    setEditing(null);
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function startEdit(t: Term) {
    setEditing(t);
    setAdding(false);
    setSelectedId(null);
    setForm({ term: t.term, definition: t.definition, aliases: t.aliases.join(", ") });
    setError("");
  }

  function cancelForm() {
    setAdding(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSave() {
    if (!form.term.trim() || !form.definition.trim()) return;
    setSaving(true);
    setError("");
    try {
      const aliases = form.aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const url = editing ? `/api/glossary/${editing.id}` : "/api/glossary";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: form.term.trim(), definition: form.definition.trim(), aliases }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      if (editing) {
        setTerms((prev) =>
          prev.map((t) => (t.id === data.id ? data : t)).sort((a, b) => a.term.localeCompare(b.term, "ja"))
        );
      } else {
        setTerms((prev) => [...prev, data].sort((a, b) => a.term.localeCompare(b.term, "ja")));
      }
      cancelForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/glossary/${id}`, { method: "DELETE" });
    setTerms((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  const isFormOpen = adding || editing !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* 検索 */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="用語を検索..."
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* 追加・編集フォーム */}
      {isFormOpen && (
        <div className="space-y-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <input
            type="text"
            value={form.term}
            onChange={(e) => setForm((p) => ({ ...p, term: e.target.value }))}
            placeholder="用語名"
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={form.definition}
            onChange={(e) => setForm((p) => ({ ...p, definition: e.target.value }))}
            placeholder="定義"
            rows={3}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            value={form.aliases}
            onChange={(e) => setForm((p) => ({ ...p, aliases: e.target.value }))}
            placeholder="別名（カンマ区切り、任意）"
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.term.trim() || !form.definition.trim()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-sm rounded-md transition-colors"
            >
              <Check size={13} />
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-sm transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 用語リスト */}
      {!isFormOpen && (
        <>
          <ul className="space-y-0.5">
            {filtered.length === 0 && (
              <li className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                {query ? "一致する用語がありません" : "用語がまだありません"}
              </li>
            )}
            {filtered.map((t) => (
              <li key={t.id}>
                {/* 用語行 */}
                <div
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 group cursor-pointer transition-colors ${
                    selectedId === t.id
                      ? "bg-blue-50 dark:bg-blue-900/30"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
                >
                  <span
                    className={`text-sm font-medium ${
                      selectedId === t.id
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {t.term}
                  </span>
                  {isWriter && (
                    <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEdit(t); }}
                        className="p-1 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                        className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  )}
                </div>

                {/* インライン定義 */}
                {selectedId === t.id && (
                  <div className="mx-2 mb-1 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t.definition}
                    </p>
                    {t.aliases.length > 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                        別名: {t.aliases.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {isWriter && (
            <button
              type="button"
              onClick={startAdd}
              className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <Plus size={14} />
              用語を追加
            </button>
          )}
        </>
      )}
    </div>
  );
}
