/**
 * GET /api/search?q=クエリ&mode=keyword|semantic
 *
 * 2 種類の検索モードを提供する:
 *
 * キーワード検索（mode=keyword、デフォルト）:
 *   PostgreSQL の ILIKE（case-insensitive LIKE）を使った部分一致。
 *   Prisma の mode: "insensitive" がこれに相当する。
 *   速度が速くシンプルだが、表記揺れ（「機械学習」vs「ML」）には対応できない。
 *
 * ベクトル検索（mode=semantic）:
 *   クエリ文字列も Embedding に変換し、全記事との コサイン類似度を計算する。
 *   意味的に近い記事を見つけられる（例: 「勾配降下法」で「最適化アルゴリズム」もヒット）。
 *   GEMINI_API_KEY が必要。設定なしの場合はキーワード検索にフォールバックする。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateEmbedding,
  cosineSimilarity,
  hasEmbeddingSupport,
} from "@/lib/embeddings";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const mode = req.nextUrl.searchParams.get("mode") ?? "keyword";

  // 空クエリは即座に空配列を返す（DB に無意味なクエリを投げない）
  if (!q.trim()) {
    return NextResponse.json([]);
  }

  // ---- ベクトル検索 ----
  if (mode === "semantic" && hasEmbeddingSupport()) {
    try {
      const queryEmbedding = await generateEmbedding(q);

      // 全記事を取得してメモリ上で類似度計算する。
      // 本来は pgvector の <=> 演算子で DB 側でソートするのが理想（O(N) → O(log N)）。
      // 現状は記事数が数百〜数千程度であれば十分なパフォーマンス。
      // 記事数が増えた場合は pgvector 移行を検討すること。
      const allEntries = await prisma.knowledgeEntry.findMany({
        select: {
          id: true,
          title: true,
          tags: true,
          updatedAt: true,
          embedding: true,
        },
      });

      const scored = allEntries
        .filter((e) => e.embedding !== null) // embedding 未生成の記事は除外
        .map((e) => ({
          id: e.id,
          title: e.title,
          tags: e.tags,
          updatedAt: e.updatedAt,
          score: cosineSimilarity(queryEmbedding, e.embedding as number[]),
        }))
        // 0.4 を下限とした理由:
        //   実験的に 0.4 未満は「ほぼ無関係」な記事になる傾向がある。
        //   デデュプリケーションの閾値（0.9）より大幅に低く設定し、
        //   「関連性があるかもしれない」記事も広めに返す。
        .filter((e) => e.score > 0.4)
        .sort((a, b) => b.score - a.score) // 類似度の高い順
        .slice(0, 20); // 上位 20 件。画面に収まる範囲で十分な候補数

      return NextResponse.json(scored);
    } catch (err) {
      // API エラー時はキーワード検索へフォールバックする（degraded mode）
      console.warn("Semantic search failed, falling back to keyword:", err);
    }
  }

  // ---- キーワード検索 ----
  // OR 条件で title・content・tags の 3 フィールドを横断検索する。
  // tags の { has: q } は PostgreSQL の配列型に対する完全一致検索。
  // 配列要素の部分一致は Prisma では直接サポートされていないため、
  // タグ検索はタグ名の完全一致のみに限定している。
  const results = await prisma.knowledgeEntry.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
        { tags: { has: q } }, // 配列フィールドの要素に q が含まれるか
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      tags: true,
      updatedAt: true,
    },
    take: 30, // 上位 30 件。キーワード検索は件数が多くなりがちなので制限する
  });

  return NextResponse.json(results);
}
