/**
 * タグ入力コンポーネント。
 *
 * UX の考え方:
 *   「タグ = 小さなチップ」として視覚的に表現し、
 *   テキスト入力とタグの追加/削除を 1 つのフィールドに統合する。
 *   Gmail のメール宛先入力や GitHub のラベル入力と同じパターン。
 *
 * 内部状態:
 *   - input: テキストエリアの現在の入力値（未確定のタグ名）
 *   - value（props）: 確定済みタグの配列
 */

"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ value, onChange }: Props) {
  const [input, setInput] = useState("");

  function addTag() {
    const tag = input.trim().toLowerCase();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg min-h-[42px] focus-within:border-blue-500 transition-colors">
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm rounded-md border border-blue-200 dark:border-blue-700/50"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:text-blue-900 dark:hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        </span>
      ))}

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={addTag}
        placeholder={value.length === 0 ? "タグを入力（Enter or カンマで追加）" : ""}
        className="flex-1 min-w-[120px] bg-transparent text-slate-800 dark:text-slate-200 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
      />
    </div>
  );
}
