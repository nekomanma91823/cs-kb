/**
 * Markdown を HTML にレンダリングするコンポーネント。
 *
 * プラグイン構成:
 *   remark（Markdown → MDAST 変換層）:
 *     - remarkMath: $...$ や $$...$$ を数式ノードとして認識する
 *     - remarkGfm: GitHub Flavored Markdown（テーブル、チェックボックス等）
 *
 *   rehype（HAST → HTML 変換層）:
 *     - rehypeKatex: 数式ノードを KaTeX で HTML に変換する
 *
 * テーマ対応:
 *   SyntaxHighlighter はインラインスタイルを使うため CSS の dark: 指定が効かない。
 *   useTheme() フックで <html class="dark"> を監視し、
 *   ダーク時は vscDarkPlus、ライト時は oneLight を動的に切り替える。
 */

"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import { useTheme } from "@/lib/theme";
import { Copy, Check } from "lucide-react";

interface Props {
  content: string;
  className?: string;
}

function CodeBlock({ language, code, isDark }: { language: string; code: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* ヘッダーバー: 言語名 + コピーボタン */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-500" />
              <span className="text-green-500">コピーしました</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              コピー
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={isDark ? vscDarkPlus : oneLight}
        language={language}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: 0 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function MarkdownRenderer({ content, className = "" }: Props) {
  const isDark = useTheme();

  /**
   * react-markdown のカスタムレンダラー。
   * useTheme の値を参照するためコンポーネント関数内で定義する。
   *
   * インラインコードの色:
   *   ライト: bg-slate-100 text-pink-600（白背景に赤みのコードが読みやすい）
   *   ダーク: bg-slate-800 text-pink-300（ダーク背景に淡いピンクが馴染む）
   */
  const components: Components = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code({ node: _node, className: cls, children, ...props }: any) {
      const match = /language-(\w+)/.exec(cls || "");
      const inline = !match;
      return inline ? (
        <code
          className="bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-300 px-1 py-0.5 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      ) : (
        <CodeBlock
          language={match[1]}
          code={String(children).replace(/\n$/, "")}
          isDark={isDark}
        />
      );
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    a({ href, children, ...props }: any) {
      return (
        <a
          href={href}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
          {...props}
        >
          {children}
        </a>
      );
    },

  };

  return (
    <div
      className={`prose max-w-none
        prose-headings:text-slate-900 dark:prose-headings:text-slate-100
        prose-p:text-slate-700 dark:prose-p:text-slate-300
        prose-strong:text-slate-900 dark:prose-strong:text-slate-100
        prose-li:text-slate-700 dark:prose-li:text-slate-300
        prose-table:text-slate-700 dark:prose-table:text-slate-300
        prose-th:text-slate-800 dark:prose-th:text-slate-200
        prose-hr:border-slate-300 dark:prose-hr:border-slate-700
        ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
