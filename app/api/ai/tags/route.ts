/**
 * POST /api/ai/tags
 *
 * Body: { title: string, content: string }
 * Response: { tags: string[] }
 *
 * Gemini を使って記事のタイトルと内容からタグ候補を生成する。
 *
 * gemini-3.1-flash-lite-preview を選んだ理由:
 *   - タグ生成は短いテキストの分類タスクで、高度な推論は不要
 *   - Flash は Pro より高速・低コストで、レスポンスが数秒以内
 *
 * プロンプト設計:
 *   「JSON配列のみで返してください」と明示する理由:
 *   モデルはマークダウンの ```json ... ``` ブロックや余分な説明文を
 *   返すことがある。明示的に指定することで解析しやすい形式に誘導する。
 *   ただし完全に保証されないため、正規表現で JSON 配列を抽出する。
 *
 * コンテンツを 2000 文字に切り捨てる理由:
 *   長文を全て送るとトークンコストが増え、レスポンスが遅くなる。
 *   タグ生成には先頭部分の内容で十分。
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireWriter } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // ライター権限チェック: タグ生成は記事作成中にのみ使われるため
  const authError = await requireWriter();
  if (authError) return authError;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません" },
      { status: 503 },
    );
  }

  const { title, content } = await req.json();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // gemini-3.1-flash-lite-preview: タグ生成のような単純分類タスク向け高速モデル
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite-preview",
  });

  const prompt = `以下のCS/ML技術記事のタイトルと内容を読み、適切なタグを5〜8個提案してください。

条件:
- 英語か日本語の短い単語・フレーズ（例: "機械学習", "Python", "最適化", "Transformer"）
- 技術カテゴリ・手法名・言語名・概念名など
- 一般的すぎる単語（「技術」「記事」など）は避ける
- JSON配列形式のみで返してください。説明文やコードブロック記法は不要です。

例: ["機械学習", "勾配降下法", "Python", "最適化", "ニューラルネットワーク"]

タイトル: ${(title || "（未入力）").slice(0, 200)}
内容（先頭2000文字）:
${(content || "").slice(0, 2000)}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Gemini の応答からJSON配列を抽出する。
    // [\s\S]* は改行を含む任意文字列にマッチ（. は改行にマッチしないため）
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) {
      return NextResponse.json({ tags: [] });
    }

    const tags: unknown = JSON.parse(match[0]);

    // 型安全のため、配列かつ文字列要素のみを受け付ける
    if (!Array.isArray(tags)) {
      return NextResponse.json({ tags: [] });
    }

    const validTags = tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    return NextResponse.json({ tags: validTags });
  } catch (err) {
    console.error("Tag generation failed:", err);
    return NextResponse.json(
      { error: "タグ生成に失敗しました" },
      { status: 500 },
    );
  }
}
