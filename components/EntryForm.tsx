/**
 * 記事の作成・編集フォームコンポーネント。
 *
 * create / edit モードを 1 つのコンポーネントで賄っている理由:
 *   フォームの構造（タイトル、タグ、エディタ）は両モードで同一。
 *   URL（POST vs PUT）と初期値のみ異なる。
 *
 * 重複チェックのフロー:
 *   1. save(skipDupCheck=false) を呼ぶ → API が 409 を返す
 *   2a. semanticDuplicates が含まれる → 意味的重複警告を表示
 *   2b. error だけが含まれる → 物理的重複エラーを表示（強制保存不可）
 *   3. ユーザーが「それでも保存」 → save(skipDupCheck=true) で再送
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Sparkles } from "lucide-react";
import { MarkdownEditor } from "./MarkdownEditor";
import { TagInput } from "./TagInput";
import { DuplicateWarning } from "./DuplicateWarning";

interface Props {
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  entryId?: string;
  mode: "create" | "edit";
}

export function EntryForm({
  initialTitle = "",
  initialContent = "",
  initialTags = [],
  entryId,
  mode,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState(initialTags);
  const [saving, setSaving] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);

  const [physicalError, setPhysicalError] = useState("");
  const [existingId, setExistingId] = useState("");
  const [existingTitle, setExistingTitle] = useState("");
  const [semanticDups, setSemanticDups] = useState<
    Array<{ id: string; title: string; similarity: number }>
  >([]);

  function clearDupState() {
    setPhysicalError("");
    setExistingId("");
    setExistingTitle("");
    setSemanticDups([]);
  }

  /**
   * Gemini でタグを自動生成し、既存タグにマージする。
   *
   * Set を使って重複排除する理由:
   *   ユーザーが手動で入力したタグと AI 提案タグが重複する場合があるため。
   *   Set は挿入順を保持するので、手動タグが先頭に来る。
   */
  async function generateTags() {
    setGeneratingTags(true);
    try {
      const res = await fetch("/api/ai/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (data.tags?.length) {
        setTags((prev) => [...new Set([...prev, ...data.tags])]);
      }
    } finally {
      setGeneratingTags(false);
    }
  }

  async function save(skipDupCheck = false) {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    clearDupState();

    try {
      const url =
        mode === "edit" ? `/api/entries/${entryId}` : "/api/entries";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, tags, skipDupCheck }),
      });

      const data = await res.json();

      if (res.ok) {
        const id = mode === "edit" ? entryId! : data.id;
        router.push(`/entries/${id}`);
        router.refresh();
        return;
      }

      if (res.status === 409) {
        if (data.semanticDuplicates) {
          setSemanticDups(data.semanticDuplicates);
        } else {
          setPhysicalError(data.error ?? "重複エラー");
          if (data.existingId) setExistingId(data.existingId);
          if (data.existingTitle) setExistingTitle(data.existingTitle);
        }
      } else {
        alert(data.error ?? "保存に失敗しました");
      }
    } finally {
      setSaving(false);
    }
  }

  const hasDupWarning = physicalError || semanticDups.length > 0;

  return (
    <div className="flex flex-col h-full gap-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タイトル"
        className="w-full bg-transparent text-2xl font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none border-b border-slate-200 dark:border-slate-800 pb-3"
      />

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <TagInput value={tags} onChange={setTags} />
        </div>
        <button
          type="button"
          onClick={generateTags}
          disabled={generatingTags || (!title.trim() && !content.trim())}
          title="AIでタグを自動生成"
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-800/50 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 disabled:text-slate-400 disabled:border-slate-200 dark:disabled:border-slate-800 disabled:bg-transparent rounded-lg transition-colors"
        >
          {generatingTags ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          {generatingTags ? "生成中..." : "AIでタグ生成"}
        </button>
      </div>

      {hasDupWarning && (
        <DuplicateWarning
          physicalError={physicalError || undefined}
          existingId={existingId || undefined}
          existingTitle={existingTitle || undefined}
          semanticDuplicates={semanticDups.length > 0 ? semanticDups : undefined}
          onDismiss={clearDupState}
          onForce={() => save(true)}
        />
      )}

      <div className="flex-1 min-h-0">
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder={`# タイトル\n\n本文をMarkdownで記述します。\n\nLaTeX数式: $E = mc^2$\n\n$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$`}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving || !title.trim() || !content.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
