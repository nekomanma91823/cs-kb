export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EntryForm } from "@/components/EntryForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Params = Promise<{ id: string }>;

export default async function EditEntryPage({ params }: { params: Params }) {
  const { id } = await params;

  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id },
    select: { id: true, title: true, content: true, tags: true },
  });

  if (!entry) notFound();

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/entries/${id}`}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">記事を編集</h1>
      </div>
      <div className="flex-1 min-h-0">
        <EntryForm
          mode="edit"
          entryId={entry.id}
          initialTitle={entry.title}
          initialContent={entry.content}
          initialTags={entry.tags}
        />
      </div>
    </div>
  );
}
