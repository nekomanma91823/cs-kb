/**
 * 記事詳細ページのサイドパネルに表示するリンク管理コンポーネント。
 *
 * 表示する情報:
 *   - 発信リンク（outgoingLinks）: この記事 → 他の記事（種別ごとにグループ化）
 *   - 被参照（incomingLinks）: 他の記事 → この記事（双方向リンクの実現）
 *   - リンク追加フォーム
 *
 * onLinksChange prop を廃止した理由:
 *   Server Component から Client Component へ関数 props を渡せない
 *   （Server Actions 以外はシリアライズ不可）ため、
 *   内部で router.refresh() を呼ぶ自己完結型にした。
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { LINK_TYPE_LABELS, LINK_TYPE_COLORS, type LinkType } from "@/lib/graph-utils";

interface EntryRef {
  id: string;
  title: string;
  tags: string[];
}

interface KnowledgeLink {
  id: string;
  linkType: LinkType;
  target?: EntryRef;
  source?: EntryRef;
}

interface Props {
  entryId: string;
  outgoingLinks: KnowledgeLink[];
  incomingLinks: KnowledgeLink[];
}

const LINK_TYPES: LinkType[] = ["PREREQUISITE", "DERIVATION", "APPLICATION"];

export function LinkManager({ entryId, outgoingLinks, incomingLinks }: Props) {
  const router = useRouter();
  const [allEntries, setAllEntries] = useState<EntryRef[]>([]);
  const [selectedEntry, setSelectedEntry] = useState("");
  const [selectedType, setSelectedType] = useState<LinkType>("PREREQUISITE");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data) =>
        setAllEntries(
          (data as EntryRef[]).filter((e) => e.id !== entryId)
        )
      );
  }, [entryId]);

  async function addLink() {
    if (!selectedEntry) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: entryId,
          targetId: selectedEntry,
          linkType: selectedType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "リンクの作成に失敗しました");
      } else {
        setShowForm(false);
        setSelectedEntry("");
        router.refresh();
      }
    } finally {
      setAdding(false);
    }
  }

  async function deleteLink(linkId: string) {
    await fetch(`/api/links/${linkId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {LINK_TYPES.map((type) => {
        const links = outgoingLinks.filter((l) => l.linkType === type);
        if (links.length === 0) return null;
        return (
          <div key={type}>
            <h4
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: LINK_TYPE_COLORS[type] }}
            >
              <ArrowRight size={12} className="inline mr-1" />
              {LINK_TYPE_LABELS[type]}
            </h4>
            <ul className="space-y-1">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between group"
                >
                  <Link
                    href={`/entries/${link.target!.id}`}
                    className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    {link.target!.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteLink(link.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-all p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {incomingLinks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 text-slate-400 dark:text-slate-500">
            <ArrowLeft size={12} className="inline mr-1" />
            被参照
          </h4>
          <ul className="space-y-1">
            {incomingLinks.map((link) => (
              <li key={link.id} className="flex items-center gap-2">
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    color: LINK_TYPE_COLORS[link.linkType],
                    backgroundColor: `${LINK_TYPE_COLORS[link.linkType]}20`,
                  }}
                >
                  {LINK_TYPE_LABELS[link.linkType]}
                </span>
                <Link
                  href={`/entries/${link.source!.id}`}
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  {link.source!.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm ? (
        <div className="space-y-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as LinkType)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-md p-2 focus:outline-none focus:border-blue-500"
          >
            {LINK_TYPES.map((t) => (
              <option key={t} value={t}>
                {LINK_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={selectedEntry}
            onChange={(e) => setSelectedEntry(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-md p-2 focus:outline-none focus:border-blue-500"
          >
            <option value="">記事を選択...</option>
            {allEntries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addLink}
              disabled={!selectedEntry || adding}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-sm rounded-md transition-colors"
            >
              {adding ? "追加中..." : "追加"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
              className="px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-sm transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <Plus size={14} />
          リンクを追加
        </button>
      )}
    </div>
  );
}
