export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isWriter } from "@/lib/auth";
import { formatDistanceToNow } from "@/lib/date-utils";
import { SuggestionPanel } from "@/components/SuggestionPanel";
import { Plus, BookOpen, Link2 } from "lucide-react";

export default async function EntriesPage() {
  const [entries, writer] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        tags: true,
        updatedAt: true,
        _count: { select: { outgoingLinks: true, incomingLinks: true } },
      },
    }),
    isWriter(),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">記事一覧</h1>
          <p className="text-slate-500 text-sm mt-1">{entries.length} 件</p>
        </div>
        {writer && (
          <Link
            href="/entries/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            新規作成
          </Link>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">記事がまだありません</p>
          {writer && (
            <Link
              href="/entries/new"
              className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
            >
              最初の記事を作成する →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/entries/${entry.id}`}
              className="block p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                    {entry.title}
                  </h2>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-400 dark:text-slate-600">
                    {formatDistanceToNow(entry.updatedAt)}
                  </p>
                  {(entry._count.outgoingLinks > 0 ||
                    entry._count.incomingLinks > 0) && (
                    <p className="text-xs text-slate-400 dark:text-slate-600 mt-1 flex items-center justify-end gap-1">
                      <Link2 size={10} />
                      {entry._count.outgoingLinks + entry._count.incomingLinks}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* AI提案パネル: ライターのみ表示（Gemini APIキー必須）*/}
      {writer && <SuggestionPanel />}
    </div>
  );
}
