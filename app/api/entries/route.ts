/**
 * GET  /api/entries    - 記事一覧取得
 * POST /api/entries    - 記事新規作成（重複チェック付き）
 *
 * 重複チェックの 3 段階:
 *   1. 物理的重複（タイトル）: DB の UNIQUE 制約と同等の事前チェック
 *   2. 物理的重複（コンテンツハッシュ）: コピペ・完全一致の検出
 *   3. 意味的重複（Embedding）: 言い換え・類似トピックの検出
 *
 * フロントエンドからの skipDupCheck フラグで 3 のみバイパスできる。
 * （意味的重複の警告を確認後、ユーザーが「それでも保存」を選んだ場合）
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/auth";
import {
  generateEmbedding,
  cosineSimilarity,
  SIMILARITY_THRESHOLD,
  hasEmbeddingSupport,
} from "@/lib/embeddings";

/**
 * 記事一覧を返す。embedding は大きい（1536 要素の float 配列）ため
 * select で明示的に除外し、レスポンスサイズを抑える。
 * _count で「リンク数」を一緒に取得することで、一覧画面でのリンク件数表示を
 * 追加クエリなしに実現する。
 */
export async function GET() {
  const entries = await prisma.knowledgeEntry.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      // Prisma の集計機能を使い、JOIN を 1 クエリに収める
      _count: {
        select: { outgoingLinks: true, incomingLinks: true },
      },
    },
  });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const authError = await requireWriter();
  if (authError) return authError;

  const body = await req.json();
  const { title, content, tags = [], skipDupCheck = false } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "タイトルと本文は必須です" },
      { status: 400 }
    );
  }

  // ---- 重複チェック 1: タイトルの完全一致 ----
  // DB の UNIQUE 制約でも弾けるが、constraint error よりも先に
  // 人間が読めるエラーメッセージと既存記事 ID を返すために事前チェックする。
  const existingByTitle = await prisma.knowledgeEntry.findUnique({
    where: { title },
    select: { id: true },
  });
  if (existingByTitle) {
    return NextResponse.json(
      { error: "同じタイトルの記事が既に存在します", existingId: existingByTitle.id },
      { status: 409 } // 409 Conflict: リソースの競合を表す HTTP ステータス
    );
  }

  // ---- 重複チェック 2: コンテンツハッシュ（完全一致検出）----
  // SHA-256 を選んだ理由:
  //   - 暗号学的に安全で衝突確率が極めて低い（2^256 分の 1）
  //   - Node.js 標準の crypto モジュールで追加依存なし
  //   - 64 文字の hex 文字列として DB に保存・比較できる
  //   - MD5 より安全で、SHA-512 より短い（DB インデックスに向く）
  const contentHash = crypto
    .createHash("sha256")
    .update(content)
    .digest("hex"); // "hex" → 16進文字列。"base64" より長くなるが可読性が高い

  const existingByHash = await prisma.knowledgeEntry.findFirst({
    where: { contentHash },
    select: { id: true, title: true },
  });
  if (existingByHash) {
    return NextResponse.json(
      {
        error: "同一内容の記事が既に存在します",
        existingId: existingByHash.id,
        existingTitle: existingByHash.title,
      },
      { status: 409 }
    );
  }

  let embedding: number[] | null = null;

  // ---- 重複チェック 3: 意味的重複（Embedding による類似度計算）----
  // skipDupCheck: ユーザーが警告を確認済みで保存を強制した場合は SKIP
  // hasEmbeddingSupport(): GEMINI_API_KEY 未設定の場合は SKIP
  if (!skipDupCheck && hasEmbeddingSupport()) {
    try {
      // タイトルと本文を結合してベクトル化。
      // タイトルだけでは内容が薄く、本文だけでは記事固有の文脈が弱まるため両方使う。
      embedding = await generateEmbedding(`${title}\n\n${content}`);

      const allEntries = await prisma.knowledgeEntry.findMany({
        select: { id: true, title: true, embedding: true },
      });

      const semanticDups = allEntries
        .filter((e) => e.embedding !== null) // embedding 未生成の記事はスキップ
        .map((e) => ({
          id: e.id,
          title: e.title,
          similarity: cosineSimilarity(
            embedding!,
            e.embedding as number[] // DB には Json 型で保存されているためキャストが必要
          ),
        }))
        .filter((e) => e.similarity >= SIMILARITY_THRESHOLD)
        .sort((a, b) => b.similarity - a.similarity); // 最も類似度の高い記事を先頭に

      if (semanticDups.length > 0) {
        // 409 で返しつつ semanticDuplicates キーを含めることで、
        // フロントエンドが「物理的エラー」と「意味的警告」を区別できる
        return NextResponse.json(
          { semanticDuplicates: semanticDups },
          { status: 409 }
        );
      }
    } catch (err) {
      // Embedding 生成の失敗は致命的ではないので警告のみ。
      // API レート制限・ネットワーク障害でも記事保存を止めないための graceful fallback。
      console.warn("Embedding generation failed:", err);
    }
  }

  const entry = await prisma.knowledgeEntry.create({
    data: {
      title,
      content,
      contentHash,
      tags,
      // embedding が null（API キーなし or エラー）の場合は省略。
      // スプレッド構文で条件付きフィールド追加: ...(条件 ? { field } : {})
      ...(embedding ? { embedding } : {}),
    },
  });

  return NextResponse.json(entry, { status: 201 }); // 201 Created
}
