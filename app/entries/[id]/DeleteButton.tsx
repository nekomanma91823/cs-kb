/**
 * 記事削除ボタン（確認ステップ付き）。
 *
 * なぜ Server Component ではなく Client Component か:
 *   - 削除確認の状態（confirming）を保持するため
 *   - router.push() で削除後のナビゲーションを行うため
 *   - API Route を直接呼び出すため
 *
 * なぜ Server Action ではなく fetch + API Route か:
 *   - EntryForm と同じ REST API（DELETE /api/entries/[id]）を使って一貫性を保つ
 *   - Server Action でも実装できるが、このプロジェクトでは API Routes に統一している
 *
 * 2 ステップ確認（confirming ステート）の UX 設計:
 *   最初のクリックで確認ダイアログを表示し、2 回目のクリックで削除を実行する。
 *   誤クリックによる意図しない削除を防ぐための標準的なパターン。
 *   モーダルダイアログより軽量でコンテキストを維持しやすい。
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false); // 確認モードかどうか
  const [deleting, setDeleting] = useState(false);     // API 呼び出し中かどうか

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/entries/${entryId}`, { method: "DELETE" });
      // 削除後は一覧ページへ遷移する（詳細ページに戻っても 404 になるため）
      router.push("/entries");
      // router.refresh() で Server Component のキャッシュを更新し、
      // 一覧ページに遷移した際に削除済み記事が表示されないようにする
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  // 確認モード: 「本当に削除しますか？」と削除/キャンセルボタンを横並びで表示
  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 dark:text-red-400">本当に削除しますか？</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {deleting ? "削除中..." : "削除"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          キャンセル
        </button>
      </div>
    );
  }

  // 通常モード: 削除ボタン（クリックで確認モードへ移行）
  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
    >
      <Trash2 size={14} /> 削除
    </button>
  );
}
