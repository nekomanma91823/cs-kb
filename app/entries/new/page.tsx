/**
 * 新規記事作成ページ。
 *
 * ?title= クエリパラメータを受け付ける理由:
 *   SuggestionPanel の「作成」リンクが /entries/new?title=XXX に遷移する。
 *   EntryForm に initialTitle として渡すことで、タイトルを事前入力する。
 *
 * Next.js 16 の変更点: searchParams が Promise になったため await が必要。
 */

import { EntryForm } from "@/components/EntryForm";

type SearchParams = Promise<{ title?: string }>;

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { title } = await searchParams;

  return (
    <div className="h-full flex flex-col p-6">
      <h1 className="text-lg font-semibold text-slate-200 mb-4">新規記事作成</h1>
      <div className="flex-1 min-h-0">
        <EntryForm mode="create" initialTitle={title ?? ""} />
      </div>
    </div>
  );
}
