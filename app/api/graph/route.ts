/**
 * GET /api/graph - グラフ可視化用のノード・エッジデータを返す
 *
 * KnowledgeGraph コンポーネントが初期化時にこのエンドポイントを呼び出し、
 * Canvas ベースのフォースグラフを描画する。
 *
 * レスポンス形式:
 *   { nodes: KnowledgeEntry[], edges: KnowledgeLink[] }
 *   D3 force simulation が期待するグラフ形式（ノードとエッジの分離）
 *
 * select で最小限のフィールドのみ取得する理由:
 *   - embedding（1536 floats）や content（長文）は不要
 *   - グラフ描画に必要なのは id・title・tags（ノードの視覚的な表現）と
 *     sourceId・targetId・linkType（エッジの接続と色分け）だけ
 *   - レスポンスサイズを最小化することでグラフ初期化を高速化する
 *
 * Promise.all で 2 クエリを並列実行する理由:
 *   entries と links は独立したテーブルで依存関係がない。
 *   直列実行より並列実行の方が合計 DB ラウンドトリップ時間が短い。
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [entries, links] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      select: { id: true, title: true, tags: true },
    }),
    prisma.knowledgeLink.findMany({
      select: { id: true, sourceId: true, targetId: true, linkType: true },
    }),
  ]);

  return NextResponse.json({ nodes: entries, edges: links });
}
