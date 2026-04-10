/**
 * Markdown エディタコンポーネント（スプリットペイン形式）。
 *
 * なぜ重量ライブラリ（@uiw/react-md-editor, CodeMirror）を使わないか:
 *   - React 19 との互換性を確保するため（多くの Markdown エディタはまだ未対応）
 *   - シンプルな textarea + MarkdownRenderer で十分な機能を実現できる
 *   - バンドルサイズを最小化できる
 *
 * 3 つの表示モード:
 *   - edit: textarea のみ（長文入力時に集中できる）
 *   - split: 左 textarea + 右プレビュー（最もよく使うモード）
 *   - preview: プレビューのみ（読み直し確認用）
 */

"use client";

import { useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Eye, Edit2, Columns } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

type ViewMode = "edit" | "preview" | "split";

/**
 * ツールバーボタンの定義。各アクションは以下の 3 種類のいずれか:
 *
 *   wrap: ["前", "後"] - 選択テキストを前後で囲む（Bold, Italic, Code etc.）
 *   prefix: "文字列"    - 行頭に文字列を挿入する（見出し）
 *   insert: "文字列"    - カーソル位置に文字列を挿入する（区切り線）
 */
const TOOLBAR_ACTIONS = [
  { label: "B",   title: "太字",          wrap: ["**", "**"] },
  { label: "I",   title: "斜体",          wrap: ["*", "*"] },
  { label: "`",   title: "インラインコード", wrap: ["`", "`"] },
  { label: "```", title: "コードブロック",  wrap: ["```\n", "\n```"] },
  { label: "$$",  title: "数式（ブロック）", wrap: ["$$\n", "\n$$"] },
  { label: "$",   title: "数式（インライン）", wrap: ["$", "$"] },
  { label: "H1",  title: "見出し1",        prefix: "# " },
  { label: "H2",  title: "見出し2",        prefix: "## " },
  { label: "H3",  title: "見出し3",        prefix: "### " },
  { label: "---", title: "区切り線",        insert: "\n---\n" },
  { label: "▶",  title: "トグル（折り畳み）", insert: "<details>\n<summary>タイトル</summary>\n\n内容\n\n</details>\n" },
];

export function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const [mode, setMode] = useState<ViewMode>("split");

  function handleToolbar(action: (typeof TOOLBAR_ACTIONS)[number]) {
    const ta = document.getElementById("md-editor") as HTMLTextAreaElement;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);

    let newValue = value;
    let cursor = start;

    if ("insert" in action && action.insert) {
      newValue = value.slice(0, start) + action.insert + value.slice(end);
      cursor = start + action.insert.length;
    } else if ("prefix" in action && action.prefix) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      newValue =
        value.slice(0, lineStart) + action.prefix + value.slice(lineStart);
      cursor = start + action.prefix.length;
    } else if ("wrap" in action && action.wrap) {
      const [before, after] = action.wrap;
      newValue =
        value.slice(0, start) + before + selected + after + value.slice(end);
      cursor = start + before.length + selected.length + after.length;
    }

    onChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* ツールバー */}
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex-wrap">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.title}
            onClick={() => handleToolbar(action)}
            className="px-2 py-0.5 text-xs font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded transition-colors"
          >
            {action.label}
          </button>
        ))}

        <div className="ml-auto flex gap-1">
          {(
            [
              { m: "edit" as ViewMode,    icon: <Edit2 size={14} />,   title: "編集" },
              { m: "split" as ViewMode,   icon: <Columns size={14} />, title: "分割" },
              { m: "preview" as ViewMode, icon: <Eye size={14} />,     title: "プレビュー" },
            ] as const
          ).map(({ m, icon, title }) => (
            <button
              key={m}
              type="button"
              title={title}
              onClick={() => setMode(m)}
              className={`p-1.5 rounded transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* エディタ本体 */}
      <div className="flex flex-1 overflow-hidden">
        {mode !== "preview" && (
          <textarea
            id="md-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "Markdownで記述してください..."}
            className={`${
              mode === "split" ? "w-1/2 border-r border-slate-300 dark:border-slate-700" : "w-full"
            } h-full resize-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-sm p-4 focus:outline-none`}
            spellCheck={false}
          />
        )}

        {mode !== "edit" && (
          <div
            className={`${
              mode === "split" ? "w-1/2" : "w-full"
            } h-full overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950`}
          >
            {value ? (
              <MarkdownRenderer content={value} />
            ) : (
              <p className="text-slate-400 dark:text-slate-600 italic">プレビューがここに表示されます</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
