/**
 * GET /api/ai/suggestions
 *
 * Response: { suggestions: Array<{ title: string; reason: string }> }
 *
 * 既存の記事一覧を Gemini に渡し、次に書くべき記事のタイトルを提案させる。
 *
 * 設計の思想:
 *   知識グラフとして「空白領域」を見つけることが目的。
 *   既存記事のタイトルとタグだけを渡す理由:
 *   - 本文まで送るとトークンが大量消費される
 *   - タイトル + タグでトピックの全体像は十分把握できる
 *
 * gemini-3.1-flash-lite-preview を選んだ理由:
 *   提案は一定の推論力が必要だが、記事数が増えてもコストを抑えたい。
 *   Flash で十分な品質が得られることを確認済み。
 *
 * キャッシュしない理由:
 *   記事が更新されるたびに提案も変わるべきで、
 *   ユーザーが明示的に「AI に聞く」ボタンを押したときのみ実行する。
 */

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/auth";

interface Suggestion {
  title: string;
  reason: string;
}

export async function GET() {
  // ライター限定: 提案機能は記事執筆者向けのワークフロー支援
  const authError = await requireWriter();
  if (authError) return authError;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ suggestions: [] });
  }

  const entries = await prisma.knowledgeEntry.findMany({
    select: { title: true, tags: true },
    orderBy: { updatedAt: "desc" },
  });

  if (entries.length === 0) {
    // 記事がまだない場合はデフォルト提案を返す
    const defaults: Suggestion[] = [
      { title: "機械学習の基礎", reason: "CS/ML知識ベースの出発点として" },
      {
        title: "ニューラルネットワーク入門",
        reason: "深層学習の土台となる概念",
      },
      { title: "確率・統計の基礎", reason: "ML理論の数学的基盤" },
    ];
    return NextResponse.json({ suggestions: defaults });
  }

  // タイトル + タグ一覧をプロンプトに埋め込む
  const existingKnowledge = entries
    .map((e) =>
      e.tags.length > 0
        ? `- ${e.title} [${e.tags.join(", ")}]`
        : `- ${e.title}`,
    )
    .join("\n");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite-preview",
  });

  const prompt = `以下はCS/ML技術知識ベースの既存記事一覧です（タイトル [タグ] の形式）:

${existingKnowledge}

上記の知識ベースを分析して、次に書くべき技術記事のタイトルを5件提案してください。

選定基準（優先順位順）:
1. 既存記事の前提・派生・応用として自然につながるトピック（知識グラフの空白を埋める）
2. まだカバーされていないCS/MLの重要概念
3. 既存記事と関連しながら深掘りできるサブトピック

以下のJSON形式のみで返してください。説明文やコードブロック記法は不要です:
[{"title": "記事タイトル", "reason": "提案理由（1〜2文）"}, ...]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // JSON 配列を応答テキストから抽出（コードブロックや前後のテキストを除去）
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ suggestions: [] });
    }

    const parsed: unknown = JSON.parse(match[0]);

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ suggestions: [] });
    }

    // 型安全のため、title と reason が文字列のオブジェクトのみ受け付ける
    const suggestions: Suggestion[] = parsed
      .filter(
        (item): item is Suggestion =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).title === "string" &&
          typeof (item as Record<string, unknown>).reason === "string",
      )
      .slice(0, 5); // 最大 5 件

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Suggestion generation failed:", err);
    return NextResponse.json({ suggestions: [] });
  }
}
