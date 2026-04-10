/**
 * 記事詳細ページの右サイドパネル（タブ切り替え）。
 *
 * タブ:
 *   - リンク: ナレッジリンクの閲覧・追加・削除（LinkManager）
 *   - 辞書:   専門用語の検索・閲覧・追加・編集・削除（GlossaryPanel）
 *
 * Client Component にする理由:
 *   タブの選択状態（useState）が必要なため。
 *   LinkManager・GlossaryPanel もどちらも Client Component。
 */

"use client";

import { useState } from "react";
import { LinkManager } from "./LinkManager";
import { GlossaryPanel } from "./GlossaryPanel";
import type { LinkType } from "@/app/generated/prisma/enums";

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
  isWriter: boolean;
}

type Tab = "links" | "glossary";

const TABS: { key: Tab; label: string }[] = [
  { key: "links", label: "リンク" },
  { key: "glossary", label: "辞書" },
];

export function EntryRightPanel({ entryId, outgoingLinks, incomingLinks, isWriter }: Props) {
  const [tab, setTab] = useState<Tab>("links");

  return (
    <aside className="w-64 shrink-0 border-l border-slate-200 dark:border-slate-800 flex flex-col">
      {/* タブヘッダー */}
      <div className="flex shrink-0 border-b border-slate-200 dark:border-slate-800">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 text-xs font-semibold uppercase tracking-wide py-3 transition-colors ${
              tab === key
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "links" ? (
          <LinkManager
            entryId={entryId}
            outgoingLinks={outgoingLinks}
            incomingLinks={incomingLinks}
            isWriter={isWriter}
          />
        ) : (
          <GlossaryPanel isWriter={isWriter} />
        )}
      </div>
    </aside>
  );
}
