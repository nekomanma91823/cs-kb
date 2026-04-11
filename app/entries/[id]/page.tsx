export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { EntryRightPanel } from "@/components/EntryRightPanel";
import { formatDate, formatDistanceToNow } from "@/lib/date-utils";
import { Edit, ArrowLeft, Calendar, Clock } from "lucide-react";
import { DeleteButton } from "./DeleteButton";
import { isWriter } from "@/lib/auth";

type Params = Promise<{ id: string }>;

export default async function EntryPage({ params }: { params: Params }) {
  const { id } = await params;

  const [entry, writer] = await Promise.all([
    prisma.knowledgeEntry.findUnique({
    where: { id },
    include: {
      outgoingLinks: {
        include: { target: { select: { id: true, title: true, tags: true } } },
        orderBy: { createdAt: "asc" },
      },
      incomingLinks: {
        include: { source: { select: { id: true, title: true, tags: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  }),
    isWriter(),
  ]);

  if (!entry) notFound();

  // Strip embedding from serialized data
  const { embedding: _emb, ...safeEntry } = entry;

  return (
    <div className="flex flex-col md:flex-row md:h-full">
      {/* Main content */}
      <article className="min-w-0 md:flex-1 md:overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/entries"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6 transition-colors"
            >
              <ArrowLeft size={14} /> 一覧に戻る
            </Link>

            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 leading-tight">
                {entry.title}
              </h1>
              {writer && (
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/entries/${id}/edit`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Edit size={14} /> 編集
                  </Link>
                  <DeleteButton entryId={id} />
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400 dark:text-slate-600">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {formatDate(entry.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {formatDistanceToNow(entry.updatedAt)}に更新
              </span>
            </div>

            {/* Tags */}
            {entry.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <MarkdownRenderer content={entry.content} />
        </div>
      </article>

      {/* Right panel: Links + Glossary */}
      <EntryRightPanel
        entryId={id}
        outgoingLinks={safeEntry.outgoingLinks as Parameters<typeof EntryRightPanel>[0]["outgoingLinks"]}
        incomingLinks={safeEntry.incomingLinks as Parameters<typeof EntryRightPanel>[0]["incomingLinks"]}
        isWriter={writer}
      />
    </div>
  );
}
