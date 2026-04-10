/**
 * 重複検出時の警告バナーコンポーネント。
 *
 * 2 つの表示モード（コンポーネント内で条件分岐）:
 *
 *   1. physicalError（赤バナー）:
 *      タイトル完全一致またはコンテンツハッシュ一致の場合。
 *      強制保存のオプションを提供しない（物理的に同一なので保存する意味がない）。
 *
 *   2. semanticDuplicates（黄バナー）:
 *      Embedding による意味的重複の場合。
 *      「それでも保存する」ボタンで強制保存を許可する。
 *      理由: 意味が近くても「別角度からの解説」として有効な場合があるため。
 *
 * props で両方を受け取るが、同時に表示することはない。
 * physicalError が優先される（EntryForm 側で先にチェックするため）。
 */

"use client";

import { AlertTriangle, ExternalLink, ArrowRight } from "lucide-react";
import Link from "next/link";

interface SemanticDup {
  id: string;
  title: string;
  similarity: number; // 0〜1 のコサイン類似度
}

interface Props {
  semanticDuplicates?: SemanticDup[];
  physicalError?: string;
  existingId?: string;       // 物理重複の場合: 既存記事へのリンク用
  existingTitle?: string;    // 物理重複の場合: 既存記事のタイトル
  onDismiss: () => void;     // 警告を閉じる
  onForce: () => void;       // 意味的重複の場合: 強制保存
}

export function DuplicateWarning({
  semanticDuplicates,
  physicalError,
  existingId,
  existingTitle,
  onDismiss,
  onForce,
}: Props) {
  // ---- 物理的重複エラー（赤バナー）----
  if (physicalError) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-4">
        <div className="flex items-start gap-3">
          {/* mt-0.5: テキストの行高と縦位置を揃えるための微調整 */}
          <AlertTriangle size={20} className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-red-700 dark:text-red-300 font-medium">{physicalError}</p>
            {existingId && (
              // 既存記事を別タブで開けるよう href を渡す
              // ExternalLink アイコンで「外部リンク」であることを視覚的に示す
              <Link
                href={`/entries/${existingId}`}
                className="mt-2 inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                既存の記事を見る <ExternalLink size={12} />
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300 text-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  // ---- 意味的重複警告（黄バナー）----
  if (semanticDuplicates && semanticDuplicates.length > 0) {
    return (
      <div className="rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-yellow-800 dark:text-yellow-300 font-medium">
              類似した記事が見つかりました（意味的重複）
            </p>
            <p className="text-yellow-700 dark:text-yellow-500 text-sm mt-1">
              以下の記事と内容が似ています。統合または既存記事の更新を検討してください。
            </p>

            {/* 類似記事の一覧 */}
            <ul className="mt-3 space-y-1.5">
              {semanticDuplicates.map((dup) => (
                <li key={dup.id} className="flex items-center gap-2">
                  <ArrowRight size={12} className="text-yellow-500 dark:text-yellow-600" />
                  {/* target="_blank": 執筆中のフォームから離れずに既存記事を確認できる */}
                  <Link
                    href={`/entries/${dup.id}`}
                    target="_blank"
                    className="text-sm text-yellow-700 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300 underline"
                  >
                    {dup.title}
                  </Link>
                  {/* 類似度をパーセント表示: toFixed(1) で小数点 1 桁まで（例: 92.3%）*/}
                  <span className="text-xs text-yellow-500 dark:text-yellow-700">
                    類似度 {(dup.similarity * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex gap-3 mt-4">
              {/* 「それでも保存」: onForce は skipDupCheck=true で再保存する */}
              <button
                type="button"
                onClick={onForce}
                className="px-3 py-1.5 bg-yellow-600 dark:bg-yellow-700 hover:bg-yellow-500 dark:hover:bg-yellow-600 text-white text-sm rounded-lg transition-colors"
              >
                それでも保存する
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="px-3 py-1.5 text-yellow-700 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300 text-sm transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // どちらの警告も該当しない場合は何も表示しない
  return null;
}
